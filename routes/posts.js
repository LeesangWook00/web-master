var express = require('express');
var router = express.Router();
const { getConnection } = require('../connect');
const oracledb = require('oracledb');

/* 게시글 목록 페이지 */
router.get('/', function (req, res, next) {
    res.render('index', { title: '게시글', pageName: 'posts/list.ejs' });
});

/* 게시글 목록 데이터 (JSON) */
router.get('/list.json', async function(req, res) {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 10;
    const word = req.query.word || ""; // 검색어 파라미터 받기
    const startRow = (page - 1) * size + 1;
    const endRow = page * size;
    let con;
    
    try {
        con = await getConnection();
        
        // 1. 전체 개수 조회
        // DB에 존재하는 view_posts 뷰를 사용하도록 변경합니다.
        let countSql = 'select count(*) as cnt from view_posts';
        let countParams = {};
        if (word) {
            // 직관적인 검색을 위해 내용(content) 검색을 제외하고, 제목(title)에서만 검색되도록 변경합니다.
            countSql += " where title like '%' || :word || '%'";
            countParams.word = word;
        }
        let countResult = await con.execute(countSql, countParams, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        // 컬럼명 대소문자 차이로 인한 에러를 방지합니다.
        const total = countResult.rows[0].CNT || countResult.rows[0].cnt || 0;

        // 2. 게시글 목록 조회
        let sql = `
            SELECT * FROM (
                SELECT a.*, ROWNUM rnum FROM (
                    SELECT * FROM view_posts
        `;
        if (word) {
            sql += " WHERE title LIKE '%' || :word || '%'";
        }
        sql += ` ORDER BY id DESC
                ) a WHERE ROWNUM <= :endRow
            ) WHERE rnum >= :startRow
        `;
        
        let queryParams = { startRow, endRow };
        if (word) {
            queryParams.word = word;
        }
        let result = await con.execute(sql, queryParams, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        // 불필요한 JSON 변환(getCircularReplacer)을 제거하고, 데이터를 안전하게 바로 매핑합니다.
        const list = result.rows.map(item => {
            const rnum = item.RNUM || item.rnum || 1;
            
            // 안전한 매핑 (소문자 프로퍼티 반환 대비)
            let title = item.TITLE || item.title || item.CONTENT || item.content || "제목 없음";
            if (title.length > 30) title = title.substring(0, 30) + "...";

            return {
                ID: item.ID || item.id || 0,
                REG_DATE: item.FMT_DATE || item.fmt_date || "", 
                RNUM: total - rnum + 1, // 전체 개수에서 현재 순번을 빼서 아래부터 오름차순으로 번호 부여
                SNAME: item.SNAME || item.sname,
                TITLE: title,
                WRITER: item.WRITER || item.writer, 
                CONTENT: item.CONTENT || item.content
            };
        });
        
        res.send({ list, total });
    } catch (err) {
        console.error("데이터 조회 에러:", err);
        // 프론트엔드에서도 에러 원인을 쉽게 파악할 수 있도록 메시지 추가
        res.status(500).send({ error: "오류 상세: " + err.message });
    } finally {
        if (con) await con.close();
    }
});

/* 게시글 작성 페이지 이동 */
router.get('/insert', function (req, res, next) {
    res.render('index', { title: '글쓰기', pageName: 'posts/insert.ejs' });
});

/* 게시글 등록 처리 (DB에 저장) */
router.post('/insert', async function (req, res) {
    // 1. 프론트엔드에서 어떤 데이터가 넘어오는지 터미널에서 확인하기 위해 로그를 찍습니다.
    console.log("등록 요청 데이터:", req.body);

    // 2. oracledb는 값이 undefined이면 에러(NJS-044)를 발생시키므로 null 또는 빈 문자열로 처리합니다.
    const writer = req.body.writer || req.body.scode || req.body.SCODE || null; 
    const content = req.body.content || "";
    const title = req.body.title || (content ? content.substring(0, 30) : "제목 없음");

    let con;
    try {
        con = await getConnection();
        
        // posts 테이블의 ID 컬럼이 GENERATED ALWAYS AS IDENTITY로 변경되었으므로, INSERT 시 ID를 제외하고 삽입합니다.
        const sql = "INSERT INTO posts(writer, title, content) VALUES(:writer, :title, :content)";
        await con.execute(sql, { writer, title, content }, { autoCommit: true });
        res.send('success');
    } catch (err) {
        console.error("게시글 등록 중 오류:", err);
        // 3. 브라우저나 콘솔에서도 원인을 바로 알 수 있도록 에러 내용을 함께 보냅니다.
        res.status(500).send("등록 실패: " + err.message);
    } finally {
        if (con) await con.close();
    }
});

module.exports = router;