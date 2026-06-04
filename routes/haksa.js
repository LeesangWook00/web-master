var express = require('express');
var router = express.Router();
const { getConnection } = require('../connect');
const oracledb = require('oracledb');
const { autoCommit } = require('oracledb');

/* 교수페이지이동 */
router.get('/pro', function (req, res, next) {
    res.render('index', { title: '교수관리', pageName: 'haksa/professors.ejs' });
});

/*교수목록 데이터 */
router.get('/pro/list.json', async function (req, res) {
    let con;
    try {
        con = await getConnection();
        const sql="select p.*, to_char(hiredate, 'YYYY-MM-DD') fdate, to_char(salary, '99,999,999') fsalary from professors p";
        const result = await con.execute(sql, {}, {outFormat:oracledb.OUT_FORMAT_OBJECT});
        res.send(result.rows);
    } catch (err) {

    } finally {
        if(con) await con.close();
    }
});

// 교수등록 페이지 이동
router.get('/pro/insert', async function(req, res){
    let con;
    let newcode='';
    try {
        con = await getConnection();
        const sql="select max(pcode)+1 code from professors";
        const result=await con.execute(sql);
        newcode = result.rows[0][0];
    }catch(err){
        console.log(err);
    }finally{
            console.log('code', newcode);
    res.render('index', {title:'교수등록', pageName:'haksa/professors_insert', code:newcode});
        if(con) await con.close();
    }
});

// 교수등록
router.post('/pro/insert', async function(req, res){
    const pcode=req.body.pcode;
    const pname=req.body.pname;
    const dept=req.body.dept;
    const hiredate=req.body.hiredate;
    const title=req.body.title;
    const salary=req.body.salary;
    console.log(pcode, pname, dept, hiredate, title, salary);
    let con;
    try{
        //ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD'; 서버에서 변경
        con = await getConnection();
        sql = `insert into professors(pcode, pname, dept, hiredate, title, salary) `;
        sql +=`values('${pcode}', '${pname}', '${dept}', TO_DATE('${hiredate}','YYYY-MM-DD'), '${title}', ${salary})`;
        console.log(sql);
        await con.execute(sql, {}, {autoCommit:true});
        res.sendStatus(200);
    }catch(err){
        console.log(err);
    }finally{
        if(con) await con.close();
    }
});

//교수 삭제
router.post('/pro/delete', async function(req, res){
    let con;
    const pcode=req.body.pcode;
    try{
        con = await getConnection();
        const sql=`delete from professors where pcode=${pcode}`;
        console.log(sql);
        await con.execute(sql, {}, {autoCommit:true});
        res.sendStatus(200);
    }catch(err){
        res.sendStatus(500);
        console.log(err);
    }finally{
        if(con) await con.close();
    }
});

/* 학생페이지이동 */
router.get('/stu', function (req, res, next) {
    res.render('index', { title: '학생관리', pageName: 'haksa/students.ejs' });
});

/*학생목록 데이터 */
router.get('/stu/list.json', async function (req, res) {
    let con;
    try {
        con = await getConnection();
        // view_students가 없을 경우를 대비해 students와 professors를 직접 조인합니다.
        // 프론트엔드 템플릿에 맞춰 생일(birthday)을 fdate로 변경하고, 지도교수 이름(pname)을 가져옵니다.
        const sql="SELECT s.scode, s.sname, s.dept, TO_CHAR(s.birthday, 'YYYY-MM-DD') fdate, p.pname FROM students s LEFT JOIN professors p ON s.advisor = p.pcode";
        const result = await con.execute(sql, {}, {outFormat:oracledb.OUT_FORMAT_OBJECT});
        res.send(result.rows);
    } catch (err) {
        console.log("학생 목록 로딩 중 에러 발생:", err);
        res.status(500).send("서버 오류");
    } finally {
        if(con) await con.close();
    }
});

//학생등록 페이지 이동
router.get('/stu/insert', async function(req, res){
    let con;
    let code;
    try{
        const con = await getConnection();
        const sql="select max(scode)+1 from students";
        const result = await con.execute(sql);
        code = result.rows[0][0];
        console.log(code);
    }catch(err){
        console.log(err);
    }finally{
        if(con) con.close();
    }
    res.render('index', {title: '학생입력', pageName:'haksa/students_insert.ejs', code});
});

// 학생등록
router.post('/stu/insert', async function(req, res){
    const scode=req.body.scode;
    const sname=req.body.sname;
    const dept=req.body.dept;
    const birthday=req.body.birthday;
    const year=req.body.year;
    const pcode=req.body.pcode;
    console.log(scode, sname, dept, birthday, year, pcode);
    let con;
    try{
        con = await getConnection();
        sql = "insert into students(scode, sname, dept, birthday, year, advisor, pass)";
        sql +=" values(:scode, :sname, :dept, to_date(:birthday, 'YYYY-MM-DD'), :year, :pcode, '1234')";
        console.log(sql);
        await con.execute(sql, {scode, sname, dept, birthday, year, pcode}, {autoCommit:true});
        res.sendStatus(200);
    }catch(err){
        console.log(err);
    }finally{
        if(con) await con.close();
    }
});

//학생 삭제
router.post('/stu/delete', async function(req, res){
    let con;
    const scode=req.body.scode;
    try{
        con = await getConnection();
        const sql=`delete from students where scode=${scode}`;
        console.log(sql);
        await con.execute(sql, {}, {autoCommit:true});
        res.sendStatus(200);
    }catch(err){
        res.sendStatus(500);
        console.log(err);
    }finally{
        if(con) await con.close();
    }
});

/* 학생 상세 페이지 이동 */
router.get('/stu/read/:scode', function (req, res) {
    const scode = req.params.scode;
    res.render('index', { title: '학생정보', pageName: 'haksa/students_read.ejs', scode: scode });
});

/* 학생 상세 데이터 가져오기 (JSON) */
router.get('/stu/:scode.json', async function (req, res) {
    const scode = req.params.scode;
    let con;
    try {
        con = await getConnection();
        const sql = "SELECT scode, sname, dept, TO_CHAR(birthday, 'YYYY-MM-DD') fdate, year, advisor FROM students WHERE scode = :scode";
        const result = await con.execute(sql, { scode }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        if (result.rows.length === 0) {
            return res.status(404).send({ error: "DB에 해당 학생 데이터가 존재하지 않습니다." });
        }
        
        res.send(result.rows[0]);
    } catch (err) {
        console.log(err);
        res.status(500).send("조회 오류");
    } finally {
        if (con) await con.close();
    }
});

/* 학생 정보 수정 적용 */
router.post('/stu/update', async function (req, res) {
    const { scode, sname, dept, birthday, year, advisor } = req.body;
    let con;
    try {
        con = await getConnection();
        const sql = `
            UPDATE students 
            SET sname=:sname, dept=:dept, birthday=to_date(:birthday, 'YYYY-MM-DD'), year=:year, advisor=:advisor 
            WHERE scode=:scode
        `;
        await con.execute(sql, { scode, sname, dept, birthday, year, advisor }, { autoCommit: true });
        res.send('success');
    } catch (err) {
        console.log(err);
        res.status(500).send("수정 오류: " + err.message);
    } finally {
        if (con) await con.close();
    }
});

/* 강좌페이지이동 */
router.get('/cou', function (req, res, next) {
    res.render('index', { title: '강좌관리', pageName: 'haksa/courses.ejs' });
});

/* 강좌목록 데이터 */
router.get('/cou/list.json', async function (req, res) {
    let con;
    try {
        con = await getConnection();
        // 강좌 테이블과 교수 테이블을 조인하여 담당 교수의 이름(pname)을 함께 가져옵니다.
        const sql = "SELECT c.lcode, c.lname, c.hours, c.room, c.capacity, c.persons, p.pname FROM courses c LEFT JOIN professors p ON c.instructor = p.pcode ORDER BY c.lcode DESC";
        const result = await con.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        res.send(result.rows);
    } catch (err) {
        console.log("강좌 목록 로딩 중 에러:", err);
        res.status(500).send("서버 오류");
    } finally {
        if (con) await con.close();
    }
});

// 강좌등록 페이지 이동
router.get('/cou/insert', function (req, res) {
    res.render('index', { title: '강좌등록', pageName: 'haksa/courses_insert.ejs' });
});

// 강좌 등록
router.post('/cou/insert', async function (req, res) {
    const { lcode, lname, hours, room, instructor, capacity } = req.body;
    let con;
    try {
        con = await getConnection();
        // 새 강좌의 기본 수강신청 인원(persons)은 0명으로 등록합니다.
        const sql = `
            INSERT INTO courses(lcode, lname, hours, room, instructor, capacity, persons) 
            VALUES(:lcode, :lname, :hours, :room, :instructor, :capacity, 0)
        `;
        await con.execute(sql, { lcode, lname, hours, room, instructor, capacity }, { autoCommit: true });
        res.sendStatus(200);
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    } finally {
        if (con) await con.close();
    }
});

// 강좌 삭제
router.post('/cou/delete', async function (req, res) {
    let con;
    const lcode = req.body.lcode;
    try {
        con = await getConnection();
        const sql = "DELETE FROM courses WHERE lcode=:lcode";
        await con.execute(sql, { lcode }, { autoCommit: true });
        res.sendStatus(200);
    } catch (err) {
        console.log(err);
        res.status(500).send(err.message);
    } finally {
        if (con) await con.close();
    }
});

module.exports = router;