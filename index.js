var express = require('express')
var bodyParser = require('body-parser')
var fs = require('fs')
var path = require('path')
var request = require('request')
var morgan = require('morgan')

var app = express()

app.disable('x-powered-by')
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))

var VERSION = '0.9.3';

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})

// setup the logger
app.use(morgan('combined', {stream: accessLogStream}))


app.use(function (req, res, next) {
  console.log(req.method + ' ' + req.url)
  next()
});

app.get('/', function (req, res) {
  res.render(__dirname + '/static/index.ejs', {
    version: VERSION
  })
})

// BLIH WEB API

function blih(httpmethod, url, signed_data, sortrepos, res) {
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
  };
  request(options, function (error, response, body) {
    if (!error)
    {
      if (sortrepos && response.statusCode == 200)
      {
        var repos = []
        for(var repo in body.repositories)
          repos.push(repo)
        repos.sort(function (a, b) {
          return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        res.send(repos)
      }
      else
        res.status(response.statusCode).send(body)
      console.log("Signed data " + signed_data + " received " + JSON.stringify(body))
    }
    else
    {
      res.send('{"ERROR":"Request to BLIH server failed."}')
      console.log('ERROR:Request to BLIH server failed.')
    }
  })
}

app.post('/api/*', function (req, res, next) {
  if (!req.body.resource || !req.body.signed_data)
    res.send('{"ERROR":"Wrong parameters"}')
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
  blih('POST', '/repositories', req.body.signed_data, false, res);
})
app.post('/api/repodel', function (req, res) {
  blih('DELETE', '/repository/' + req.body.resource, req.body.signed_data, false, res)
})
app.post('/api/reposetacl', function (req, res) {
  blih('POST', '/repository/' + req.body.resource + '/acls', req.body.signed_data, false, res)
})


// STATIC FILES

app.get('/blih-web.css', function (req, res) {
  res.sendFile(__dirname + '/static/blih-web.css')
})
app.get('/meow.js', function (req, res) {
  res.sendFile(__dirname + '/static/meow.js')
})
app.get('/modal.js', function (req, res) {
  res.sendFile(__dirname + '/node_modules/vanilla-modal/dist/index.js')
})
app.get('/blih-web.js', function (req, res) {
  res.sendFile(__dirname + '/static/blih-web.js')
})

app.use(function (req, res, next) {
  res.status(404).send('404')
});

app.listen(1337, function () {
  console.log('Started BLIH Web on port 1337.')
})
