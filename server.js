// Maxime Louet - https://github.com/maximelouet/blih-web
// MIT License

var express = require('express')
var bodyParser = require('body-parser')
var request = require('request')

var app = express()

app.disable('x-powered-by')
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))

var VERSION = '1.4.1'


app.get('/', function (req, res) {
    res.render(__dirname + '/static/index.ejs', {
        version: VERSION
    })
})


// BLIH Web API

function blih(httpmethod, url, signed_data, sortrepos, res) {
    var body
    try {
        body = JSON.parse(signed_data)
    } catch(e) {
        console.log('Error: invalid client parameters (signed data).')
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
        body: JSON.parse(signed_data)
    }
    request(options, function (error, response, body) {
        if (!error)
        {
            if (sortrepos && response.statusCode == 200)
            {
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
                var oui = JSON.parse(signed_data);
                username = oui.user;
            }
            catch (e) {
                console.log('Warning: cannot extract username from signed_data.')
            }
            console.log(username + ' ' + httpmethod + ' ' + url + ' (' + response.statusCode + ')')
        }
        else
        {
            console.log('Error: request to BLIH server failed.')
            res.status(500).send('{"ERROR":"Request to BLIH server failed."}')
        }
    })
}

app.post('/api/*', function (req, res, next) {
    if (!req.body.resource || !req.body.signed_data)
    {
        console.log('Error: invalid client parameters (body).')
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

app.use(function (req, res, next) {
    res.status(404).send('Nothing here!')
})


// Main server

app.listen(1337, function () {
    console.log('Started BLIH Web on port 1337.')
})
