var express = require('express');
var router = express.Router();
const { getConnection } = require('../connect');
const { outFormat } = require('oracledb');
const OracleDB = require('oracledb');

/* 로그인페이지 이동 */
router.get('/login', function (req, res, next) {
    res.render('index', {title:'로그인', pageName:'login.ejs'});
});

//로그인 체크
router.post('/login', async function(req, res){
    const id = req.body.id;
    const pass = req.body.pass;
    const role = req.body.role; // 'student' or 'professor'
    console.log(id, pass, role);
    let con;
    try{
        con = await getConnection();
        if (role === 'professor') {
            // 교수는 통일된 비밀번호('1234')로 검증합니다.
            if (pass !== '1234') {
                return res.send(null);
            }
            let sql = "select * from professors where pcode=:id";
            let result=await con.execute(sql, {id}, {outFormat:OracleDB.OUT_FORMAT_OBJECT});
            res.send(result.rows[0] || null);
        } else {
            // 학생은 students 테이블에서 비밀번호까지 함께 확인합니다.
            let sql = "select * from students where scode=:id and pass=:pass";
            let result=await con.execute(sql, {id, pass}, {outFormat:OracleDB.OUT_FORMAT_OBJECT});
            res.send(result.rows[0] || null);
        }
    }catch(err){
        console.log(err);
        res.sendStatus(500);
    }finally{
        if(con) await con.close();
    }
})
module.exports = router;
