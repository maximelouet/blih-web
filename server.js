/*
 * Copyright 2018 Maxime Louet
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

var express = require('express')
var bodyParser = require('body-parser')
var request = require('request')
var cookieParser = require('cookie-parser')

var app = express()

app.disable('x-powered-by')
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))
app.use(cookieParser())

var VERSION = '1.8.1'
var SERVER_PORT = 1337


app.get('/', function (req, res) {
    res.render(__dirname + '/static/index.ejs', {
        version: VERSION,
        login: req.cookies.saved_login
    })
})

function pad(n) {
    return (n < 10 ? '0' + n : n)
}

function log(message) {
    var d = new Date();
    console.log(pad(d.getFullYear()) + '-' + pad(d.getMonth() + 1)  + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' ' + message);
}


// BLIH Web API

function blih(httpmethod, url, signed_data, sortrepos, res) {

    var body

    try {
        parsed_body = JSON.parse(signed_data)
    } catch(e) {
        log('Error: invalid client parameters (signed data).')
        res.status(400).send('{"ERROR":"Invalid parameters (signed data)"}')
        return;
    }

    var options = {
        headers: {
            'Accept-Encoding': 'identity',
            'Connection': 'close',
            'User-Agent': 'blih-web-' + VERSION
        },
        json: true,
        method: httpmethod,
        url: 'https://blih.epitech.eu' + url,
        body: parsed_body
    }

    request(options, function (error, response, body) {
        if (!error) {
            if (sortrepos && response.statusCode == 200) {
                var repos = []
                for (var repo in body.repositories)
                    repos.push(repo)
                repos.sort(function (a, b) {
                    return a.toLowerCase().localeCompare(b.toLowerCase())
                })
                res.send(repos)
            }
            else
                res.status(response.statusCode).send(body)
            var username = '(unknown user)';
            try {
                var oui = parsed_body;
                username = oui.user;
            }
            catch (e) {
                log('Warning: cannot extract username from signed_data.')
            }
            log(username + ' ' + httpmethod + ' ' + url + ' (' + response.statusCode + ')')
        } else {
            log('Error: request to BLIH server failed.')
            res.status(500).send('{"ERROR":"Request to BLIH server failed."}')
        }
    })

}

app.post('/api/*', function (req, res, next) {
    if (!req.body.resource || !req.body.signed_data) {
        log('Error: invalid client parameters (body).')
        res.status(400).send('{"ERROR":"Invalid parameters (body)."}')
    }
    else
        next()
})

app.post('/api/repolist', function (req, res) {
    blih('GET', '/repositories', req.body.signed_data, true, res)
})
app.post('/api/repogetacl', function (req, res) {
    blih('GET', '/repository/' + req.body.resource + '/acls', req.body.signed_data, false, res)
})
app.post('/api/repogetinfo', function (req, res) {
    blih('GET', '/repository/' + req.body.resource, req.body.signed_data, false, res)
})
app.post('/api/repocreate', function (req, res) {
    blih('POST', '/repositories', req.body.signed_data, false, res)
})
app.post('/api/repodel', function (req, res) {
    blih('DELETE', '/repository/' + req.body.resource, req.body.signed_data, false, res)
})
app.post('/api/reposetacl', function (req, res) {
    blih('POST', '/repository/' + req.body.resource + '/acls', req.body.signed_data, false, res)
})


// Persistent usernames

app.post('/rememberme', function (req, res) {
    if (req.body.saved_login) {
        res.cookie('saved_login', req.body.saved_login, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true })
        res.status(200).send('OK')
    } else {
        res.status(200).send('Nothing done')
    }
})
app.post('/forgetme', function (req, res) {
    if (req.body.saved_login) {
        res.clearCookie('saved_login')
        log(req.body.saved_login + ' FORGET ME')
        res.status(200).send('OK')
    } else {
        res.status(200).send('Nothing done')
    }
})


// Static files

app.get('/blih-web.css', function (req, res) {
    res.sendFile(__dirname + '/static/blih-web.min.css')
})
app.get('/blih-web.js', function (req, res) {
    res.sendFile(__dirname + '/static/blih-web.min.js')
})
app.get('/meow.js', function (req, res) {
    res.sendFile(__dirname + '/static/meow.js')
})
app.get('/modal.js', function (req, res) {
    res.sendFile(__dirname + '/node_modules/vanilla-modal/dist/index.js')
})
app.get('/dom', function (req, res) {
    res.sendFile(__dirname + '/static/dom.html')
})
app.get('/blih.py', function (req, res) {
    res.sendFile(__dirname + '/static/blih.py')
})
app.get('/favicon.png', function (req, res) {
    res.sendFile(__dirname + '/static/favicon.png')
})
app.get('/manifest.json', function (req, res) {
    res.sendFile(__dirname + '/static/manifest.json')
})

app.use(function (req, res, next) {
    res.status(404).send('Nothing here!')
})


// Main server

app.listen(SERVER_PORT, function () {
    log('Started BLIH Web v' + VERSION + ' on port ' + SERVER_PORT + '.')
})
