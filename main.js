
'use strict';

const { runSql, queryPromise } = require('./db/index.js')
var path = require('path'),
  socketio = require('socket.io'),
  express = require('express'),
  http = require('http'),
  webtelnet = require('./webtelnet-proxy.js'),
  compression = require('compression'),
  crypto = require('crypto'),
  bodyParser = require('body-parser');
const e = require('express');

const key = 'uN4=dX4>rV2+'
var conf = {
  telnet: {
    host: '127.0.0.1',
    port: 9999,
  },
  web: {
    host: '0.0.0.0',
    port: 80,
  },
  www: path.resolve(__dirname + '/www'),
  logTraffic: true,
};

var argv = process.argv;
var me = argv[1];
var args = require('minimist')(argv.slice(2));

if (args._.length < 2) {
  process.stdout.write(
    'Syntax: webtelnet <http-port> <telnet-port> [options]\n' +
    'Options: \n' +
    '    [-h <telnet-host>]\n' +
    '    [-w <path/to/www>]\n' +
    '    [-c <charset>]\n'
  );
  process.exit(0);
}

conf.web.port = parseInt(args._[0], 10);
conf.telnet.port = parseInt(args._[1], 10);

if (args.h) conf.telnet.host = args.h;
if (args.w) conf.www = path.resolve(args.w);

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.use(compression());
app.use(express.static(conf.www))
app.get("/login", async (req, res) => {
  let { name, pass, token } = req.query;
  getDateYMD();
  name = name.trim();
  pass = pass.trim();
  const md5 = crypto.createHash('md5');
  const _token = md5.update(getDateYMD() + key + name + pass).digest('hex')
  console.log(_token)

  const pattern = /^[a-z\\s]/;
  if (_token != token) {
    res.json({
      "code": 1,
      "message": "token错误 err-001"
    });
    return;
  }
  else if (name == "") {
    res.json({
      "code": 1,
      "message": "账号不能为空！"
    });
    return;
  }
  else if (name.length < 4 || name.length > 12) {
    res.json({
      "code": 1,
      "message": "账号长度为4-12个字节！"
    });
    return;
  }
  else if (!pattern.test(name)) {
    res.json({
      "code": 1,
      "message": "账号必须以小写字母开头！"
    });
    return;
  }
  else if (pass.trim() == "") {
    res.json({
      "code": 1,
      "message": "密码不能为空！"
    });
    return;
  }
  const result = await queryPromise(`select pass from user where name='${name}'  limit 1`)
  if (result != null && result.length > 0) {
    const item = result[0];
    console.log(item)
    const _pass = item["pass"]
    console.log(_pass)

    const pmd5 = crypto.createHash('md5');
    pass = pmd5.update(key + name + pass).digest('hex')
    if (_pass != pass) {
      res.json({
        "code": 1,
        "message": "密码错误！"
      });
      return;
    } else {
      const _server = await queryPromise(`select * from server `)
      res.json({
        "code": 0,
        "message": "登录成功！",
        "data": {
          "serverList": [..._server]
        }
      });
      return;
    }
  } else {
    res.json({
      "code": 1,
      "message": "账号错误！"
    });
    return;
  }

})
app.get("/reg", async (req, res) => {
  let { name, pass, token, phone, mail } = req.query;
  getDateYMD();
  name = name.trim();
  pass = pass.trim();
  const md5 = crypto.createHash('md5');
  const _token = md5.update(getDateYMD() + key + name + pass + phone + mail).digest('hex')
  console.log(_token)

  var pattern = /^[a-z\\s]/,
    phone_pattern = /^(13[0-9]|14[01456879]|15[0-35-9]|16[2567]|17[0-8]|18[0-9]|19[0-35-9])\d{8}$/,
    mail_pattern = /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/;
  if (_token != token) {
    res.json({
      "code": 1,
      "message": "token错误 err-001"
    });
    return;
  }
  else
    if (name == "") {
      res.json({
        "code": 1,
        "message": "账号不能为空！"
      });
      return;
    }
    else if (name.length < 4 || name.length > 12) {
      res.json({
        "code": 1,
        "message": "账号长度为4-12个字节！"
      });
      return;
    }
    else if (!pattern.test(name)) {
      res.json({
        "code": 1,
        "message": "账号必须以小写字母开头！"
      });
      return;
    }
    else
      if (pass.trim() == "") {
        res.json({
          "code": 1,
          "message": "密码不能为空！"
        });
        return;
      }
      else if (phone.trim() == "") {
        res.json({
          "code": 1,
          "message": "手机号不能为空！"
        });
        return;
      }
      else if (!phone_pattern.test(phone)) {
        res.json({
          "code": 1,
          "message": "手机号码格式错误！"
        });
        return;
      }
      else if (mail.trim() == "") {
        res.json({
          "code": 1,
          "message": "邮箱不能为空！"
        });
        return;
      }
      else if (!mail_pattern.test(mail)) {
        res.json({
          "code": 1,
          "message": "邮箱地址格式错误！"
        });
        return;
      }
  const result = await queryPromise(`select name from user where name='${name}'  limit 1`)
  if (result != null && result.length > 0) {
    const item = result[0];
    const _name = item["name"]
    if (_name != null && _name.trim() != "") {
      res.json({
        "code": 1,
        "message": "账号已经被注册"
      });
      return;

    }
  }
  const pmd5 = crypto.createHash('md5');
  pass = pmd5.update(key + name + pass).digest('hex')
  const sql = `INSERT INTO user(name,phone,pass,mail,type) values('${name}','${phone}','${pass}','${mail}',0)`;
  await runSql(sql)
  res.json({
    "code": 0,
    "message": "注册成功"
  });
  return;
})
app.get("/mobi/loginto", async (req, res) => {
  let { id, pass, token } = req.query;
  getDateYMD();
  let name = id.trim();
  pass = pass.trim();
  const md5 = crypto.createHash('md5');
  const _token = md5.update(getDateYMD() + key + name + pass).digest('hex')
  console.log(_token)

  const pattern = /^[a-z\\s]/;

  if (name == "") {
    res.send("账号不能为空！");
    return;
  }
  else if (name.length < 4 || name.length > 12) {
    res.send("账号长度为4-12个字节！");
    return;
  }
  else if (!pattern.test(name)) {
    res.send("账号必须以小写字母开头！");
    return;
  }
  else if (pass.trim() == "") {
    res.send("密码不能为空！");
    return;
  }
  const result = await queryPromise(`select pass from user where name='${name}'  limit 1`)
  if (result != null && result.length > 0) {
    const item = result[0];
    console.log(item)
    const _pass = item["pass"]
    console.log(_pass)

    const pmd5 = crypto.createHash('md5');
    pass = pmd5.update(key + name + pass).digest('hex')
    if (_pass != pass) {
      res.send("密码错误！");
      return;
    } else {
      const _server = await queryPromise(`select * from server `)
      const _text = '$l#' + changeServer(_server) + "|123@qq.com"
      console.log(_text)
      res.send(_text);
      return;
    }
  } else {
    res.json("账号错误！");
    return;
  }

})
app.get("/mobi/reg", async (req, res) => {
  let { id, pass, token, phone, mail } = req.query;
  getDateYMD();
  let name = id.trim();
  pass = pass.trim();
  const md5 = crypto.createHash('md5');
  const _token = md5.update(getDateYMD() + key + name + pass + phone + mail).digest('hex')
  console.log(_token)

  var pattern = /^[a-z\\s]/,
    phone_pattern = /^(13[0-9]|14[01456879]|15[0-35-9]|16[2567]|17[0-8]|18[0-9]|19[0-35-9])\d{8}$/,
    mail_pattern = /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/;

  if (name == "") {
    res.json({
      "code": 1,
      "message": "账号不能为空！"
    });
    return;
  }
  else if (name.length < 4 || name.length > 12) {
    res.json({
      "code": 1,
      "message": "账号长度为4-12个字节！"
    });
    return;
  }
  else if (!pattern.test(name)) {
    res.json({
      "code": 1,
      "message": "账号必须以小写字母开头！"
    });
    return;
  }
  else
    if (pass.trim() == "") {
      res.json({
        "code": 1,
        "message": "密码不能为空！"
      });
      return;
    }
 
  const result = await queryPromise(`select name from user where name='${name}'  limit 1`)
  if (result != null && result.length > 0) {
    const item = result[0];
    const _name = item["name"]
    if (_name != null && _name.trim() != "") {
      res.send("账号已经被注册");
      return;

    }
  }
  const pmd5 = crypto.createHash('md5');
  pass = pmd5.update(key + name + pass).digest('hex')
  const sql = `INSERT INTO user(name,phone,pass,mail,type) values('${name}','${phone}','${pass}','${mail}',0)`;
  await runSql(sql)
  res.send("注册成功");
  return;
})
app.get("/mobi/vers", (req, res) => {
  res.send('1.0');
})
app.get("/mobi/check", (req, res) => {
  res.send(key);
})
var httpserver = app.listen(conf.web.port, conf.web.host, function () {
  console.log('listening on ' + conf.web.host + ':' + conf.web.port);
})

// create socket io
var io = socketio.listen(httpserver);

// create webtelnet proxy and bind to io
var webtelnetd = webtelnet(io, conf.telnet.port, conf.telnet.host);
if (args.c) webtelnetd.setCharset(args.c);
else webtelnetd.setCharset("gbk");

function getDateYMD() {
  var date = new Date()
  return (date.getFullYear() + "-" + addZero(String((date.getMonth() + 1)), 2) + "-" + addZero(String(date.getDate()), 2));
}
function addZero(str, length) {
  var strlen = str.length;
  if (strlen >= length)
    return str;
  else
    return new Array(length - strlen + 1).join("0") + str;
}
function changeServer(result) {
  let res = '';
  result.forEach(element => {
    res +="|"+ element["name"] + '&' + element["path"] + '&' + element["prot"] + '&' + element["prot"] + '&2017-11-06 10:00' + "&" + element["verify"] + ""
  });
  return res.slice(1) 
}