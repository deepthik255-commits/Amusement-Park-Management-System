const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    secure: true,
    host: 'smtp.gmail.com',
    port: 465,
    auth: {
        user:'r363523@gmail.com',
        pass:'qipa jvhi evgx ward'
    }
})

function sendMail(to, sub, msg) {
    transporter.sendMail({
        to: to,
        subject: sub,
        html: msg
    });
    console.log("Mail sent");
}

sendMail("r363523@gmail.com","This is subject","This is message");