const Joi = require('joi');
const bcrypt = require('bcryptjs');
const { User, generateAuthToken } = require('../models/user');
const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send({ success: false, message: error.details[0].message });

  const { email, password, fcmtoken } = req.body;
  const lowerCaseEmail=String(email).trim().toLocaleLowerCase()

  const user = await User.findOne({ email:lowerCaseEmail });

  if (!user) return res.status(400).send({ success: false, message: 'Invalid credentials' });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).send({ success: false, message: 'Invalid credentials' });

  if (user.status == 'deleted') return res.status(400).send({ success: false, message: 'User has been deleted. Contact admin for further support.' });
  if (user.status == 'deactivated') return res.status(400).send({ success: false, message: 'User has been deactivated. Contact admin for further support.' });

  user.fcmtoken = fcmtoken||""
  await user.save()
  const token = generateAuthToken(user._id,user.type);
  res.send({
    token: token,
    user: user,
    success: true
  });
});
router.post('/admin', async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send({ success: false, message: error.details[0].message });

  const { email, password } = req.body;
  const lowerCaseEmail=String(email).trim().toLocaleLowerCase()

  const user = await User.findOne({ email:lowerCaseEmail });

  if (!user) return res.status(400).send({ success: false, message: 'Invalid credentials' });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(400).send({ success: false, message: 'Invalid credentials' });

  if (user.type !== 'admin') return res.status(400).send({ success: false,message: 'Invalid credentials'  });

  const token = generateAuthToken(user._id,user.type);
  res.send({
    token: token,
    user: user,
    success: true
  });
});


function validate(req) {
  const emailSchema = {
    email: Joi.string().min(5).max(255).email(),
    password: Joi.string().min(5).max(255).required(),
    fcmtoken: Joi.string().min(0).max(1024).allow(null).optional()
  };

  const schema = Joi.object(emailSchema)

  return schema.validate(req);
}


module.exports = router; 
