const { z } = require('zod');

// Wraps a zod schema into Express middleware; on failure, returns a
// 400 with clear, field-level messages instead of a stack trace.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }
    req.body = result.data;
    next();
  };
}

const schemas = {
  register: z.object({
    fullName: z.string().trim().min(2, 'Please enter your full name.').max(120),
    email: z.string().trim().email('Enter a valid email address.'),
    mobile: z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Enter a valid mobile number with country code.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
  }),
  verifyOtp: z.object({
    userId: z.string().min(1),
    emailCode: z.string().length(6),
    smsCode: z.string().length(6),
  }),
  resendOtp: z.object({
    userId: z.string().min(1),
    channel: z.enum(['email', 'sms']),
  }),
  login: z.object({
    identifier: z.string().trim().min(3, 'Enter your email or mobile number.'),
    password: z.string().min(1, 'Enter your password.'),
  }),
  forgotPassword: z.object({
    email: z.string().trim().email('Enter a valid email address.'),
  }),
  resetPassword: z.object({
    token: z.string().min(10),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
  }),
  contact: z.object({
    name: z.string().trim().min(1),
    email: z.string().trim().email(),
    subject: z.string().trim().optional(),
    message: z.string().trim().min(5),
    source: z.enum(['contact', 'feedback']).default('contact'),
  }),
};

module.exports = { validate, schemas };
