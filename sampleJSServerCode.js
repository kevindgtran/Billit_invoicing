var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var User = require('./models/user');
var Invoice = require('./models/invoice');
var session = require('express-session');
var db = require('./models');
var app = express();
var text = 'hello world from email';
var nodemailer = require('nodemailer');
var fs = require('fs');
var pdf = require('html-pdf');
var html = fs.readFileSync('testpdf.html', 'utf8');
var options = { format: 'Letter' };

//Middleware
app.use(express.static('public'));
app.use(session({
    saveUninitialized: true,
    resave: true,
    secret: 'SuperSecretCookie',
    cookie: { maxAge: 30 * 60 * 1000 } //30 minute cookie lifespan
  }));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

//Routes
//GET signup route
app.get('/signup', function (req, res) {
  res.render('signup');
});

//POST signup route
app.post('/users', function (req, res) {
  console.log(req.body)
  User.createSecure(req.body.name, req.body.email, req.body.password, function (err, newUser) {
    req.session.userId = newUser._id;
    res.redirect('/dashboard');
  });
});

//GET login route
app.get('/login', function (req, res) {
  res.render('login');
});

//authenticate and log in user
app.post('/sessions', function (req, res) {
  User.authenticate(req.body.name, req.body.email, req.body.password, function (err, loggedInUser) {
    if (err){
      res.redirect('/loginerror');
    } else {
      req.session.userId = loggedInUser._id;
      res.redirect('/dashboard');
    }
  });
});

//GET login error route
app.get('/loginerror', function(req, res) {
   res.render('pages/loginerror');
});

//GET signed out route
app.get('/signedout', function(req, res) {
   res.render('pages/signedout');
});

//GET index route
app.get('/', function(req, res) {
   res.render('pages/index');
});

//GET dashboard route
app.get('/dashboard', function (req, res) {
// find user currently logged in
User.findOne({_id: req.session.userId}, function (err, currentUser) {
  res.render('pages/dashboard.ejs', {user: currentUser})
  });
});

//GET how-to route
app.get('/howto', function (req, res) {
User.findOne({_id: req.session.userId}, function (err, currentUser) {
  res.render('pages/howto.ejs', {user: currentUser})
  });
});

//GET new invoice route
app.get('/newinvoice', function (req, res) {
User.findOne({_id: req.session.userId}, function (err, currentUser) {
  res.render('pages/newinvoice.ejs', {user: currentUser})
  });
});

//GET logout route
app.get('/logout', function (req, res) {
req.session.userId = null;  // remove the session user id
res.redirect('/login');  // redirect to login
});

app.get('/api/invoices', function(req, res) {
  Invoice.find({})
    .populate('user')
    .exec(function(err, success) {
      console.log(err);
      res.json(success);
    });
});

//POST to invoices
app.post('/api/invoices', function(req, res) {
    var newInvoice = new Invoice(req.body);
    User.findOne({
        name: req.body.user,
    }, function(err, invoiceUser) {
        if (err) {
            console.log(err);
            return
        }
        newInvoice.user = invoiceUser;
        invoiceUser.invoice.push(newInvoice);
        invoiceUser.save(function(err, succ) {
            if (err) {
                console.log(err);
            }
            newInvoice.save(function(err, succ) {
                if (err) {
                    console.log(err);
                }
                res.redirect('../dashboard');
            })
        });
    });
});

app.put('/api/invoices/:id', function(req, res) {
  db.Invoice.findById(req.params.id, function(err, foundInvoice) {
    if(err) { console.log('invoicesController.update error', err); }
    foundInvoice.title = req.body.title;
    foundInvoice.number = req.body.number;
    foundInvoice.date = req.body.date;
    foundInvoice.status = req.body.status;
    foundInvoice.customerName = req.body.customerName;
    foundInvoice.description = req.body.description;
    foundInvoice.quantity = req.body.quantity;
    foundInvoice.rate = req.body.rate;
    foundInvoice.customerEmail = req.body.customerEmail;
    foundInvoice.save(function(err, savedInvoice) {
      if(err) { console.log('saving altered invoice failed'); }
      res.json(savedInvoice);
    });
  });
})

//Delete invoice
app.delete('/api/invoices/:id', function(req, res) {
  Invoice.find({})
  .populate('user')
  db.Invoice.findOneAndRemove({ _id: req.params.id }, function(err, foundInvoice){
    res.json(foundInvoice);
  });
});

app.get('/showUser', function(req, res){
  res.render('pages/showuser.ejs')
  console.log();
})

//GET current user route
app.get('/api/currentuser', function(req, res) {
  User.findOne({
    _id: req.session.userId
  })
  .populate('invoice')
  .exec(function(err, user) {
     if(!user) {
       console.log("no user found", null);
     } else {
       res.json(user);
     }
  });
})

app.post('/printpdf', function(req, res1){
  console.log("print button works!");
  pdf.create(html, options).toFile('./testpdf.pdf', function(err, res) {
    if (err) return console.log(err);
    console.log(res); // { filename: '/app/businesscard.pdf' }

  });
})

//GET email reminder & transporter route
app.post('/emailreminder', function(req,res){
  var email = req.query.email;
  console.log("email is: " + email);
  var transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
          user: 'billitcustomer@gmail.com',
          pass: 'meanstack'
      }
  });
  var mailOptions = {
      from: 'billitcustomer@gmail.com', // sender address
      to: email, // list of receivers
      subject: 'Invoice payment reminder', // Subject line
      text: "Hi! This is an email reminder to pay your invoice"
  }

  transporter.sendMail(mailOptions, function(error, info){
  if(error){
      console.log(error);
  }else{
      console.log('Message sent: ' + info.response);
  };
});
});

app.listen(process.env.PORT || 3000)
