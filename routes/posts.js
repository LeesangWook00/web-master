var express = require('express');
var router = express.Router();
const { getConnection } = require('../connect');
const oracledb = require('oracledb');

/* 게시글 목록 */
router.get('/', function (req, res, next) {
    res.render('index', { title: '게시글', pageName: 'posts/list.ejs' });
});

//게시글 목록 데이터
router.get('/list.json', async function(req, res){
    const page=parseInt(req.query.page) || 1;
    const size=parseInt(req.query.size) || 10;
    const startRow = (page-1) * size + 1;
    const endRow = page * size;
    let con;
    try{
        con = await getConnection();
        let sql="select * from view_posts where rn between :startRow and :endRow";
        let result=await con.execute(sql, {startRow, endRow}, {outFormat:oracledb.OUT_FORMAT_OBJECT});
        const list=result.rows;
        sql="select count(*) from view_posts";
        result=await con.execute(sql);
        const total=result.rows[0][0];
        res.send({list, total});
    }catch(err){
        console.log(err);
    }finally{
        if(con) await con.close();
    }
});

module.exports = router;