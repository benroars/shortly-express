var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var crypto = require('crypto');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use( session( { secret: 'keyboard cat', cookie: { maxAge: 60000 } } ) );
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

var isAuthenticated = function (req, res, next, fail) {
  var sess = req.session;
  if (!sess.username) { //check db for valid entry otherwise redirect
    fail();
  } else {
    console.log('Authenticated as:', sess.username);
    next();
  }
};

var ifNotAuthenticatedSendToLogin = function(req, res, successRenderPage) {
  isAuthenticated(req, res, function() {
    console.log('rendering', successRenderPage);
    res.render(successRenderPage);
  }, function() {
    console.log('redirecting to login');
    res.redirect('login');
    res.end();  
  });
};
app.get('/', function(req, res) {
  ifNotAuthenticatedSendToLogin(req, res, 'index');
});

app.get('/create', function(req, res) {
  ifNotAuthenticatedSendToLogin(req, res, 'create');
});

app.get('/links', function(req, res) {
  isAuthenticated(req, res, () => {
    Links.reset().fetch().then(function(links) {  //links is a collection of link models
      res.status(200).send(links.models);
    });
  }, () => {
    console.log('redirecting to login');
    res.redirect('login');
    res.end();  
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login', 
function(req, res) {
  console.log('rendering login');
  res.render('index');
});

app.post('/login', function(req, res) {

  console.log('posting');
  var sess = req.session;
  //sess.username = req.body.username;

  var username = req.body.username;
  var password = req.body.password;

  var hash = crypto.createHash('sha1');
  hash.update(password);

  db.knex('users').where({username: username, password: hash.digest('hex')}).count().then(countObj => {
    var count = countObj[0]['count(*)'];
    console.log('at count: ', count);
    if ( count === 1) {
      sess.username = username;
      console.log('Logged in as:', username);
      
      res.redirect('/');
      res.end();

    } else {

      console.log('Invalid username / password');
      res.redirect('/login');
    }
  })
  .catch(e => console.log('ERROR', e));

  // res.render('index');
});

app.post('/signup', function(req, res, done) {
//bcrypt 

  var sess = req.session;

  var username = req.body.username;
  var password = req.body.password;
  var hash = crypto.createHash('sha1');
  hash.update(password);
  db.knex('users').where({username: username}).count().then(countObj => {
    var count = countObj[0]['count(*)'];
    if ( count === 0) {
      db.knex('users').insert({username: username, password: hash.digest('hex')})
        .catch(err => console.error('database error:', err));
      sess.username = username;
      res.redirect('/');
      res.end();
    } else {
      console.log('User already exists');
      res.render('index');
      res.end();
    }
    done();
  })
  .catch(e => console.log('ERROR', e));
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
