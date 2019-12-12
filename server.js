/*
 * Copyright 2017-2020 Maxime Louet
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * GitHub repository: https://github.com/maximelouet/blih-web
 */

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const path = require('path');
const staticify = require('staticify')(path.join(__dirname, 'public'));

const app = express()

app.disable('x-powered-by')
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(staticify.middleware);

const VERSION = '2.2.1'
const SERVER_PORT = 1337

app.get('/', (req, res) => {
    res.render(__dirname + '/public/index.ejs', {
        version: VERSION,
        cssPath: staticify.getVersionedPath('/blih-web.css'),
        jsPath: staticify.getVersionedPath('/blih-web.js'),
        meowPath: staticify.getVersionedPath('/meow.js'),
        modalPath: staticify.getVersionedPath('/modal.js')
    })
})

app.get(/^\/(repositories|sshkeys)/, (req, res) => {
    res.redirect('/')
})
app.get(/^\/(repository-create|sshkey-upload)$/, (req, res) => {
    res.redirect('/')
})

function pad(n) {
    return (n < 10 ? '0' + n : n)
}

function log(message) {
    var d = new Date();
    console.log(pad(d.getFullYear()) + '-' +
        pad(d.getMonth() + 1) + '-' +
        pad(d.getDate()) + ' ' +
        pad(d.getHours()) + ':' +
        pad(d.getMinutes()) + ':' +
        pad(d.getSeconds()) + ' ' +
        message);
}

function interpret_response(method, url, response) {
    if (method == 'GET' && url == '/repositories') {
        let repos = []
        for (let repo in response.repositories) {
            repos.push({
                name: repo,
                uuid: response.repositories[repo].uuid
            })
        }
        repos.sort( (a, b) => {
            return (a.name.toUpperCase() > b.name.toUpperCase()) ? 1 : ((b.name.toUpperCase() > a.name.toUpperCase()) ? -1 : 0)
        })
        return (repos)
    }
    else if (method == 'GET' && url == '/sshkeys') {
        let keys = []
        for (let key in response) {
            keys.push({
                name: key,
                content: response[key]
            })
        }
        keys.sort( (a, b) => {
            return (a.name.toUpperCase() > b.name.toUpperCase()) ? 1 : ((b.name.toUpperCase() > a.name.toUpperCase()) ? -1 : 0)
        })
        return (keys)
    }
    else if (method == 'GET' && url.startsWith('/repository/') && !url.endsWith('/acls')) {
        return ({
            uuid: response.message.uuid,
            creation_time: response.message.creation_time,
            description: response.message.description
        })
    }
    else if (method == 'GET' && url.startsWith('/repository/') && url.endsWith('/acls')) {
        let acls = []
        for (let acl in response) {
            acls.push({
                user: acl,
                rights: response[acl]
            })
        }
        acls.sort( (a, b) => {
            return (a.user.toUpperCase() > b.user.toUpperCase()) ? 1 : ((b.user.toUpperCase() > a.user.toUpperCase()) ? -1 : 0)
        })
        let final = {};
        for (let acl in acls) {
            final[acls[acl].user] = acls[acl].rights;
        }
        return (final)
    }
    else if (
        (method == 'DELETE' && url.startsWith('/repository/')) ||
        (method == 'POST' && url.startsWith('/repository/') && url.endsWith('/acls'))) {
        return (null)
    }
    else {
        return (response)
    }
}

function interpret_error(method, url, response) {
    return (response)
}

function interpret_server_error(error) {
    let result = {
        code: 502,
        body: '{"error":"Request to BLIH Server failed."}'
    }
    if (error.code === 'ETIMEDOUT') {
        log('Error: request to BLIH server timed out.')
        result.code = 504
        result.body = '{"error":"Request to BLIH server timed out."}'
    }
    else if (error.connect === true) {
        log('Error: unable to connect to BLIH server.')
        result.code = 502
        result.body = '{"error":"Unable to connect to BLIH server."}'
    }
    return (result)
}


// BLIH Web API

function blih(method, url, signed_data, res) {

    try {
        parsed_body = JSON.parse(signed_data)
    }
    catch(e) {
        log('Error: invalid client parameters (signed data).')
        res.status(400).send('{"error":"Invalid parameters (signed data)"}')
        return;
    }

    if (url == '/sshkeys' && method == 'POST' && parsed_body.data.sshkey) {
        parsed_body.data.sshkey = encodeURIComponent(parsed_body.data.sshkey).replace(/\%2F/g, '/')
    }

    const options = {
        headers: {
            'Accept-Encoding': 'identity',
            'Connection': 'close',
            'User-Agent': 'blih-web-' + VERSION
        },
        json: true,
        method: method,
        url: 'https://blih.epitech.eu' + url,
        body: parsed_body,
        timeout: 5000
    }

    request(options, (error, response, body) => {

        let result = {
            code: (!error) ? response.statusCode : 0,
            body: null
        }
        if (!error) {
            codeToSend = response.statusCode
            if (response.statusCode == 200) {
                result.body = interpret_response(method, url, body)
            }
            else {
                result.body = interpret_error(method, url, body)
            }
        }
        else {
            result = interpret_server_error(error)
        }

        res.status(result.code).send(result.body)

        let username = '(unknown user)';
        try {
            username = parsed_body.user;
        }
        catch (e) {
            log('Warning: cannot extract username from signed_data.')
        }
        log(username + ' ' + method + ' ' + url + ' (' + ((!error) ? response.statusCode : 'error') + ')')
    })

}

app.post('/api/*', (req, res, next) => {
    if (!req.body.signed_data) {
        log('Error: invalid client parameters.')
        res.status(400).send('{"error":"Invalid parameters."}')
    }
    else {
        next()
    }
})

app.post('/api/repo/list', (req, res) => {
    blih('GET', '/repositories', req.body.signed_data, res)
})
app.post('/api/repo/getacl', (req, res) => {
    blih('GET', '/repository/' + encodeURIComponent(req.body.resource) + '/acls', req.body.signed_data, res)
})
app.post('/api/repo/setacl', (req, res) => {
    blih('POST', '/repository/' + encodeURIComponent(req.body.resource) + '/acls', req.body.signed_data, res)
})
app.post('/api/repo/getinfo', (req, res) => {
    blih('GET', '/repository/' + encodeURIComponent(req.body.resource), req.body.signed_data, res)
})
app.post('/api/repo/create', (req, res) => {
    blih('POST', '/repositories', req.body.signed_data, res)
})
app.post('/api/repo/delete', (req, res) => {
    blih('DELETE', '/repository/' + encodeURIComponent(req.body.resource), req.body.signed_data, res)
})

app.post('/api/ssh/list', (req, res) => {
    blih('GET', '/sshkeys', req.body.signed_data, res)
})
app.post('/api/ssh/upload', (req, res) => {
    blih('POST', '/sshkeys', req.body.signed_data, res)
})
app.post('/api/ssh/delete', (req, res) => {
    blih('DELETE', '/sshkey/' + encodeURIComponent(req.body.resource), req.body.signed_data, res)
})


app.use( (req, res, next) => {
    res.status(404).send('Nothing here!')
})


// Main server

app.listen(SERVER_PORT, () => {
    log('Started BLIH Web v' + VERSION + ' on port ' + SERVER_PORT + '.')
})
