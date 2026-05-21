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
    const scode = req.body.scode;
    const pass = req.body.pass;
    console.log(scode, pass);
    let con;
    try{
        con = await getConnection();
        let sql = "select * from students where scode=:scode";
        let result=await con.execute(sql, {scode}, {outFormat:OracleDB.OUT_FORMAT_OBJECT});
        console.log("DB 조회 결과:", result.rows[0]); // 어떤 컬럼들이 가져와지는지 확인
        res.send(result.rows[0]);
    }catch(err){
        console.log(err);
        res.sendStatus(500);
    }finally{
        if(con) await con.close();
    }
})
module.exports = router;
