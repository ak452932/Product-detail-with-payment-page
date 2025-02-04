const crypto=require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer=require('nodemailer');
const sendgridTransport=require('nodemailer-sendgrid-transport');
const { validationResult } = require('express-validator');
const User = require('../models/user');
const path = require('path');
const fs = require('fs');
//const { validationResult } = require('express-validator');

const transporter=nodemailer.createTransport(sendgridTransport({
  
}));


exports.getLogin = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    errorMessage: message,
    oldInput: {
      email: '',
      password: ''
    },
    validationErrors: []
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    errorMessage: message,
    oldInput: {
      email: '',
      password: '',
      confirmPassword: ''
    },
    validationErrors: []
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password
      },
      validationErrors: errors.array()
    });
  }

  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          errorMessage: 'Invalid email or password.',
          oldInput: {
            email: email,
            password: password
          },
          validationErrors: []
        });
      }
      bcrypt
        .compare(password, user.password)
        .then(doMatch => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save(err => {
              console.log(err);
              res.redirect('/');
            });
          }
          return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            errorMessage: 'Invalid email or password.',
            oldInput: {
              email: email,
              password: password
            },
            validationErrors: []
          });
        })
        .catch(err => {
          console.log(err);
          res.redirect('/login');
        });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};


exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const errors=validationResult(req);
  if(!errors.isEmpty())
  {
    console.log(errors.array());
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      errorMessage: errors.array()[0].msg
    });
  }
  User.findOne({ email: email })
    .then(userDoc => {
      if (userDoc) {
        req.flash('error', 'Email already Exist');
        return res.redirect('/signup');
      }
      return bcrypt
        .hash(password, 12)
        .then(hashedPassword => {
          const user = new User({
            email: email,
            password: hashedPassword,
            cart: { items: [] }
          });
          return user.save();
        })
        .then(result => {
         res.redirect('/login');
         return transporter.sendMail({
          to:email,
          from:'ak452932@gmail.com',
          subject:'singup succeeded',
          html:'<h1> you successfully singup!'
         })
        })
        .catch(err => {
          console.log(err);
    })
   
    });
    
};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    console.log(err);
    res.redirect('/');
  });
};
exports.getReset = (req, res, next) => {
  //  console.log(req.flash('error'));
  let message=req.flash('error');
  if(message.length>0)
  {
    message=message[0];
  }
  else{
    message=null;
  }
    res.render('auth/reset', {
      path: '/reset',
      pageTitle: 'Reset Password',
      errorMessage: message
    });
  };

  exports.postReset=(req,res,next)=>{
    const otp = crypto.randomInt(100000, 999999).toString();
    
    req.session.otp = otp;
    crypto.randomBytes(32,(err,buffer)=>{
      if(err)
      {
        console.log(err);
        return res.reidrect('/');
      }
      const token=buffer.toString('hex');
      User.findOne({email:req.body.email})
      .then(user=>{
        if(!user)
        {
          req.flash('error','No account with that email found');
          return res.redirect('/reset');
        }
        user.resetToken=token;
        user.resetTokenExpiration=Date.now()+3600000;
        return user.save();
      })
      .then(result=>{
        transporter.sendMail({
          to:req.body.email,
          from:'ak452932@gmail.com',
          subject:'Password Reset',
          html:`
          <p> You requested a password reset</p>
          <p>Click this and ${otp} <a href="http://localhost:3000/reset/${token}">Link</a> to reset password</p>
          `

        });
      });
    });
  }

  exports.getNewPassword=(req,res,next)=>{
    const token =req.params.token;
    User.findOne({resetToken:token,resetTokenExpiration:{$gt:Date.now()}})
    .then(user=>{
      let message=req.flash('error');
      if(message.length>0)
      {
        message=message[0];
      }
      else{
        message=null;
      }
        res.render('auth/new-password', {
          path: '/new-password',
          pageTitle: 'new  Password',
          errorMessage: message,
          
          passwordToken:token,
          userId:user._id.toString()
        });
    
    })
    .catch(err=>{
      console.log(err);
    })
   
  }

  exports.postNewPassword=(req,res,next)=>{
    const newPassword=req.body.password;
    const userId=req.body.userId;
    const passwordToken=req.body.passwordToken;
    let resetUser;
    User.findOne({
      resetToken:passwordToken,
      resetTokenExpiration:{$gt:Date.now()},
      _id:userId
    })
    .then(user=>{
      resetUser=user;
      return bcrypt.hash(newPassword,12);
    })
    .then(hashedPassword=>{
      resetUser.password=hashedPassword;
      resetUser.resetToken=undefined;
      resetUser.resetTokenExpiration=undefined;
      return resetUser.save();
    })
    .then(result=>{
      console.log('password has been updated.');
      console.log(result);
      res.redirect('/login');
    })
    .catch(err=>{
      console.log(err);
    });
  };


  // otp

  exports.getOtp = (req, res, next) => {
    res.render('auth/otp', { 
      path: '/otp',
      pageTitle: 'Request OTP',
      csrfToken: req.csrfToken(),
      errorMessage: null
    });
  };
  
  exports.postOtp = (req, res, next) => {
    const email = req.body.email;
    const otp = crypto.randomInt(100000, 999999).toString();
    
    req.session.otp = otp;
    req.session.email = email;
  
    const mailOptions = {
      from: 'ak452932@gmail.com',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}`
    };
  
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.redirect('/otp');
      }
      return res.redirect('/verify-otp');
    });
  
  };
  
  exports.getVerify = (req, res, next) => {
    res.render('auth/verify-otp', { 
      path: '/verify-otp',
      pageTitle: 'Request OTP',
      csrfToken: req.csrfToken(),
      errorMessage: null
    });
  };
  
  exports.postVerify = (req, res, next) => {
    const otp = req.body.otp;
  
    if (otp === req.session.otp) {
      return res.render('auth/login');
    } else {
      req.flash('error', 'Invalid OTP');
      return res.render('auth/verify-otp', {
        path: '/verify-otp',
        pageTitle: 'Verify OTP',
        csrfToken: req.csrfToken(),
        errorMessage: 'Invalid OTP'
      });
    }
  };
