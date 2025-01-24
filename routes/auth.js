const express = require('express');
const csrf = require('csurf');

const { check } = require('express-validator');

const authController = require('../controllers/auth');

const router = express.Router();
const csrfProtection = csrf();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post('/login', authController.postLogin);

router.post('/signup',check('email').isEmail().withMessage('please enter valid Email'),authController.postSignup);

router.post('/logout', authController.postLogout);
router.get('/reset', authController.getReset);
router.post('/reset', authController.postReset);
router.get('/reset/:token', authController.getNewPassword);
router.post('/new-password', authController.postNewPassword);


router.get('/otp', csrfProtection, authController.getOtp);
router.post('/otp', csrfProtection, authController.postOtp);
router.get('/verify-otp', csrfProtection, authController.getVerify);
router.post('/verify-otp', csrfProtection, authController.postVerify);


module.exports = router;