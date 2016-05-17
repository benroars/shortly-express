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


var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: 'e366776c52f1e9503ff4',
    clientSecret: '46cec6aa24b530fc2d398d373be56e3fd8d82142',
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile.id);
  }
));

app.use(passport.initialize());
app.use(passport.session());

app.get('/login', 
function(req, res) {
  res.render('login');
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
});


app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    console.log('AUTHENTICATED...');
    req.session.isAuth = true;
    res.redirect('/');
});

app.use(function(req, res, next) {
  //var sess = req.session;
  //console.log(sess.username);
  console.log(req.session);
  if (!req.session.isAuth) {
    res.redirect('auth/github');
  } else {
    next();
  }
});



// app.get('/signup', 
// function(req, res) {
//   res.render('signup');
// });


app.post('/login', function(req, res) {

  var sess = req.session;

  var username = req.body.username;
  var password = req.body.password;

  var hash = crypto.createHash('sha1');
  hash.update(password);

  db.knex('users').where({username: username, password: hash.digest('hex')}).count().then(countObj => {
    var count = countObj[0]['count(*)'];
    if ( count === 1) {
      sess.username = username;
      res.redirect('/');
    } else {
      console.log('Invalid username / password');
      res.redirect('login');
      //res.writeHead(301, {'Location': '/login'})
      //res.end();
    }
  })
  .catch(e => console.log('ERROR', e));
});

app.post('/signup', function(req, res, done) {

  var sess = req.session;

  var username = req.body.username;
  var password = req.body.password;
  var hash = crypto.createHash('sha1');
  hash.update(password);
  db.knex('users').where({username: username}).count().then(countObj => {
    var count = countObj[0]['count(*)'];
    if ( count === 0) {
      db.knex('users').insert({username: username, password: hash.digest('hex')})
        .then(result => {
          sess.username = username;
          res.redirect('/');
          //res.end();
          console.log('sending redirection response');
        })
        .catch(err => console.error('database error:', err));
    } else {
      console.log('User already exists');
      res.render('signup');
      res.end();
    }
  })
  .catch(e => console.log('ERROR', e));
});

// ----------------------------------------------------------------------------------------
// Check every endpoint below this line for user authentication ---------------------------
// ----------------------------------------------------------------------------------------




// Pages that require authentication

app.get('/', function(req, res) {
 // if(!req.session.isAuth) {
 //   res.redirect('/login');
 // } else {
    res.render('index');
  //}
});

app.get('/logout', 
function(req, res) {
  console.log('at the logout');
  req.session.destroy();
  res.render('login');

});

app.get('/create', function(req, res) {
  res.render('index');
});

app.get('/links', function(req, res) {
  Links.reset().fetch().then(function(links) {  //links is a collection of link models
    res.status(200).send(links.models);
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
