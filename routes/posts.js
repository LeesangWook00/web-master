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
    const startRow = (page - 1) * size + 1;
    const endRow = page * size;
    let con;
    
    try {
        con = await getConnection();
        
        // 1. 전체 개수 조회 (번호 역순 계산을 위해 먼저 조회)
        let countSql = 'select count(*) as cnt from USER107.VIEW_POSTS';
        let countResult = await con.execute(countSql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        const total = countResult.rows[0].CNT;

        // 2. 게시글 목록 조회
        // 뷰(VIEW_POSTS)에 RN 컬럼이 존재하지 않아 발생하는 ORA-00904(부적합한 식별자) 에러를 해결하기 위해, 
        // 오라클의 ROWNUM을 활용하는 인라인 뷰(서브쿼리) 방식으로 페이징 쿼리를 수정합니다.
        let sql = `
            SELECT * FROM (
                SELECT v.*, ROWNUM rn FROM USER107.VIEW_POSTS v WHERE ROWNUM <= :endRow
            ) WHERE rn >= :startRow
        `;
        let result = await con.execute(sql, { startRow, endRow }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        
        // 순환 참조 에러를 완벽하게 방지하기 위한 안전 변환 처리
        const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key, value) => {
                if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) return; // 순환 참조(부모를 다시 참조하는 부분) 무시
                    seen.add(value);
                }
                return value;
            };
        };
        const rawList = JSON.parse(JSON.stringify(result.rows, getCircularReplacer()));
        
        // 콘솔 출력 예시와 동일한 키(key) 이름으로 매핑
        const list = rawList.map(item => {
            const rn = item.rn || item.RN || 1;
            
            // 제목이 30자를 초과할 경우 말줄임표 처리
            let title = item.TITLE || item.CONTENT || "제목 없음";
            if (title.length > 30) title = title.substring(0, 30) + "...";

            return {
                ID: item.ID || rn || 0,
                REG_DATE: item.FMT_DATE || "", // 뷰에서 생성한 FMT_DATE 컬럼을 사용해 작성일 표시
                RNUM: total - rn + 1, // 전체 개수에서 현재 순번을 빼서 아래부터 오름차순으로 번호 부여
                SNAME: item.SNAME,
                TITLE: title,
                WRITER: item.WRITER, // 뷰에 있는 WRITER 컬럼 매핑
                CONTENT: item.CONTENT
            };
        });
        
        res.send({ list, total });
    } catch (err) {
        console.error("데이터 조회 에러:", err);
        res.status(500).send({ error: "데이터 조회 중 오류가 발생했습니다." });
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
    const scode = req.body.scode;
    const content = req.body.content;
    let con;
    try {
        con = await getConnection();
        // 날짜(pdate)는 오라클 테이블 생성 시 DEFAULT SYSDATE로 설정했으므로 알아서 들어갑니다.
        const sql = "INSERT INTO posts(scode, content) VALUES(:scode, :content)";
        await con.execute(sql, { scode, content }, { autoCommit: true });
        res.send('success');
    } catch (err) {
        console.error("게시글 등록 중 오류:", err);
        res.status(500).send("등록 실패");
    } finally {
        if (con) await con.close();
    }
});

module.exports = router;