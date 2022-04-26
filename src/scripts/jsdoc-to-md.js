/**
 * [DollarS-docs] scripts/jsdoc-to-md.js
 * config に指定した JavaScript を解析し、md ドキュメントを自動作成する。
 * (1) 保存先 jsdoc フォルダが洗い出しされる。content 内にないフォルダは作成される。
 * (2) generate-frontmatted-mds が実行され、対応言語に対する md が作成される。
 * (3) jsdoc の記載内容が各 md に挿入される。
 * このコードは Dollar-Synquery Developers のソースコメントの変更を反映するために用いられる。
 * そこから生成される各ファイル（特に言語展開ファイル）は翻訳者により変更されていることがある。
 * ソースへの「逆展開」ができればいいが、それは混乱や予期せぬ書き換えを発生させるので、一方通行が良さそう。
 *   => Title、Desc は記述がなければ上書きしないようにする。
 * jsDoc からの記述が元の記述を上書いた場合は、コミット時にマージするようにする。
 * 最終的に生成
 */
const NULL = null, TRUE = true;
const fs = require("fs"), cp = require("child_process");
const u = require("./util.js");
const Logger = u.getLogger(__filename.split('/').pop());

let getEnv;
if(process.env.npm_config_argv) {
  // yarn => process.argv に引き継がれている
  getEnv = k=>{
    const pair = [ `--${k}`, `-${k}` ], argv = process.argv.slice(2);
    let val;
    argv.forEach((v, i)=>{
      if(val == NULL) return;
      if(pair.includes(v)) val = argv[i + 1] && String(argv[i + 1]).indexOf('-') != 0 ? argv[i + 1]: 'true';
      if(pair.includes(v.split('=')[0])) val = v.split('=').slice(1).join('=');
    });
    return val;
  }
} else {
  // npm run => npm_config_xxx に登録されている
  getEnv = k=>process.env[`npm_config_${k.replace(/\-/g, '_')}`];
}
// --at-clean 付で実行したい場合、getEnv('at-clean') が 'true' になる。

const EOL = "\n";
const Kws = {
  // Types
  Types: {
    PublicThing: '@public',
    PrivateThing: '@private'
  },
  // Attributes
  Tags: ['@ignore', '@async', '@sync', '@abstract', '@readonly', '@constant', '@require',
  '@api', '@prototype'],
  // Need explains
  Defs: ['@jsdoc', '@name', '@namespace', '@exports', '@class', '@param', '@description', '@example',
   '@setter', '@getter', '@callback', '@return', '@resolve', '@reject']
};

const orders = { };
const config = u.config();
(async g=>{ // g === global
  const defLng = config.defln;
  const wlnReg = new RegExp(`^(${config.wln.join('|')}):`);
  const scrs = config.scripts;
  const mds = { };
  await Promise.resolve().then(()=>{

    // (1) 保存先 jsdoc フォルダが洗い出しされる。
    // o content 内にフォルダがあるかのチェックがされる。
    // x content 内にないフォルダは作成される 
    // (*) 無駄なフォルダが作成されるのを防ぐため。
    if(!u.isArray(scrs.files)) {
      return; 
    }
    Logger.info('Extracting jsdocs ...');
    return u.seekDir(scrs.workdir, { patterns: scrs.files, filterEmpty: TRUE }).then(r=>{
      Logger.info(`Found ${r.directories.length}  directories, ${[ 0 ].concat(r.directories.map(d=>d.files.length)).reduce((p, c)=>p + c)} files`);
      let when = Promise.resolve();
      // js ファイルディレクトリが r.directories 分見つかったことになる。
      // この段階ではレベルはわからない。格納されるディレクトリの場所で決定されるので、jsdoc キーを解析して付与する。
      r.directories.forEach((d, idx)=>{
        d.files.forEach(file=>{
          when = when.then(()=>genDoc(scrs, file.name, file.filepath)).then(docs=>{

            // docs = [ { tags: [ ], defs: { "@x": { contents: [ ] } } }]
            docs.forEach((docObj, docIdx)=>{
              if(docObj.tags['@ignore']) {
                return;
              }
              const docGet = k=>u.getVal(docObj, k);
              console.log(`analyzing ${file.name} comment No.${docIdx + 1} ...`, docGet('defs'));
              // @ignore のついたコンテンツはパスする
              if(docGet('tags').includes('@ignore')) {
                return;
              }
              // jsdoc specification check
              // @jsdoc が指定されていない場合はエラーにより処理を終了する。
              const jsdoc = docGet('defs.@jsdoc.0.contents.0');
              const order_format = scrs.order_format || '000000000';
              if(!jsdoc) {
                throw 'Some @pubic/@private commented area doesn\'t specify @jsdoc. Write @jsdoc pathname or set as @ignore';
              }
              const alias = scrs.alias || { };
              const pos = jsdoc.split('/').map(k=>alias[k] || k);
              const lev = pos.length;
              // Target directory check
              let dir = u.path([ scrs.docsdir ].concat( pos ).join('/'));
              if(!fs.statSync(dir).isDirectory()) {
                // 対象ディレクトリが存在しない場合はエラーにより処理を終了する。
                // => クラウド API ではゼロから作成するので、ディレクトリを作成する仕様とする。
                if(getEnv('at-clean') != 'true') {
                  throw `Cannot find target directory ${dir}`;
                }
                cp.execSync(`mkdir -p ${dir}`);
              }

              // Create target directory box
              // 対象ディレクトリに分類する。
              // 対象ディレクトリの中に desc_key ベースのフォルダを作成する。
              // (*) jsdoc をループしているので、どの順番に出てくるかはわからない。
              let orderObj = orders;
              pos.forEach(k=>(orderObj = orderObj[k] = orderObj[k] || { }));

              const md_v = mds[dir] = mds[dir] || { contents: [ ] };
              const one = {
                file, level: lev, order: Object.keys(orderObj).length + 1, // 同一フォルダにあるキーの数でナンバリング TODO 指定することある?
                tags: docGet('tags'), desc_key: NULL, '@title': { }
              };
              one.get = (k, ln)=>u.getVal(one, `${k}.${ln || defLng}`);
              // Get language if specified
              // Detect any spec if exists in for each statement
              // genDoc した時点では全てのキーワードが入っている（docObj）が、one になると
              // 入力のあったキーワード + 次の処理で生成されたキーワードしかない。
              Object.keys(docGet('defs')).forEach(def=>{
                if([ '@jsdoc' ].includes(def)) return;
                const defa = docGet(`defs.${def}`);
                const defv = defa.map((defBox, defIdx)=>{
                  const v = { };
                  let ln = defLng, nativeType;
                  defBox.contents.forEach(t=>{

                    // (1) nativeType definition
                    const mtc = t.match(/<(\w+)>/);
                    if(mtc && global[ nativeType = [mtc[1].charAt(0).toUpperCase(), mtc[1].substr(1)].join('') ]) {
                      one.nativeType = nativeType.toLowerCase();
                      t = t.replace(mtc[0], '');
                    }
                    // (2) detect language
                    if(wlnReg.test(t)) {
                      ln = t.substr(0, 2), t = t.substr(3);
                    }
                    if([ '@name', '@namespace' ].includes(def) && defLng === ln && !one.get('@title', ln)) {
                      // タイトルの補完サポート
                      // 1行目を自動的にタイトル扱いする
                      config.wln.forEach(ln=>!one.get('@title', ln) && (one['@title'][ln] = [ t.trim() ]));
                      return;
                    }
                    // (3) append a line as content
                    t = t.trim()
                    if(t.charAt(0) == '|' && t[t.length - 1] != '|') {
                      t += '|'; // markdown table の補完 (https://notepm.jp/help/markdown-table)
                    }
                    (v[ln] = v[ln] || [ ]).push(t.trim());

                  });
                  return v;
                });
                if(defv.length) { one[def] = defv; }
              });
              const fix = (pos.length ? pos[ pos.length - 1 ].split('_')[ 0 ].substr(0, lev * 2): '');
              const odr = String(one.order);
              const sup = order_format.length - fix.length - odr.length;
              if(sup < 0) {
                throw `Short of order_format length: ${order_format.length} but ${fix.length} + ${odr.length}`;
              }
              const fixedText = u.charFix(one['@title']['en']);
              orderObj[fixedText] = docIdx;
              one.desc_key = [ [fix, new Array(sup).fill(0).join(''), odr].join(''), fixedText ].join('_');
              // この desc_key のディレクトリは存在する必要がある。
              cp.execSync(`mkdir -p ${[ dir, one.desc_key ].join('/')}`);
              md_v.contents.push(one);
              // => あとはこれらを mds に投入する

            });

          });
        });
      });
      return when;
    });

  }).then(()=>{

    // (2) generate-frontmatted-mds が実行され、対応言語に対する md が作成される。
    Logger.info('Generate-frontmatted-mds ...');
    return require('./generate-frontmatted-mds.js');

  }).then(()=>{

    // (3) jsdoc の記載内容が各 md に挿入される。
    Logger.info('Writing mds ...');
    let when = Promise.resolve();
    Object.keys(mds).forEach((md_p, md_i)=>{
      const md_v = mds[md_p];
      // console.log(`[${('00' + (md_i + 1)).substr(-3)}] ${md_p}`, JSON.stringify(md_v, NULL, '  '));
      config.wln.forEach(ln=>{
        // 言語ごとに md ファイルを仕立てていく。
        // desc_key は自動生成していく。そこには既存の Directory があるかもしれないので、hasDoc で検証しながら作っていく。
        md_v.contents.forEach(one=>{
          const t = one.get('@title', ln).join('');
          const parent = one.level == 0 ? NULL: md_p.split('/').slice(-2, -1)[0];
          const tocObj = {
            alias: u.charFix(t),
            title: t,
            level: one.level,
            desc_key: one.desc_key,
            parent
          };
          // ここで tocObj 登録の attribute 以外は全て文書作成を実施する。
          const explain_main = one.get('@name.0', ln) || one.get('@namespace.0', ln);
          const example_main = one.get('@example.0', ln);
          let bdyDoc = "";
          bdyDoc += `<span class="tag"> ${one.tags.map(t=>t.substr(1)).join(' </span><span class="tag"> ')} </span>` + EOL;
          bdyDoc += EOL;
          if(u.isArray(explain_main)) {
            bdyDoc += explain_main.join(EOL) + EOL;
          }
          if(u.isArray(example_main)) {
            bdyDoc += example_main.join(EOL) + EOL;
          }
          // front-matter で指定される attribute 値
          // { alias, title, desc_key }
          when = when.then(()=>u.fixDoc({ 
            dirpath: [ md_p, one.desc_key ].join('/') 
          }, ln, tocObj, bdyDoc));
        });
      });
      when = when.then(()=>{
        Logger.info(`Writing ${md_p.replace(u.path(scrs.docsdir), '')} finished.`);
      });
    });
    return when;

  }).then(()=>{
    Logger.info('Complete');
  })['catch'](e=>{
    Logger.error('Failure', e);
  });
  return;
  // <-- END_OF_MAIN <--
  function genDoc(scrs, file, fp) {
    console.log('Generating jsDoc document for ' + file + ' ...');
    const structure = { };
    const jsdoc = scrs.jsdoc || { };
    // jsdoc
    // (1) @public もしくは @private を探す
    // (2) そこから */ もしくは @ を探す。
    // (3) 取得できた範囲をひとつの文書とする
    // (4) */ が見つかっていた場合で、文書内に /* がなければ、jsdoc の終わりとみなす。
    return Promise.resolve().then(()=>{

      const src = fs.readFileSync(fp).toString('utf-8');
      console.log(`  Script content length is ${src.length} bytes.`);
      const docs = [ ];
      [ Kws.Types.PublicThing, Kws.Types.PrivateThing ].forEach(kwd=>{
        let pos = 0, idx;
        while( (idx = src.substr(pos).indexOf(kwd)) != -1 ) {
          
          pos += idx + kwd.length;
          // console.log(`  Docs type ${kwd}(${docs.length + 1}) pos:${pos}`);
          const doc = { 
            status: NULL, s_idx: 0, e_idx: 0, 
            cursor: [ ],
            tags: [ ], defs: { }
          };
          doc.status = kwd;
          doc.s_idx = doc.cursor[0] = pos;
          docs.push(doc);
          // DOC 部分の取り出し
          while((idx = src.substr(doc.cursor[0]).indexOf('*/')) != -1) {
            doc.cursor[1] = doc.cursor[0] + idx + ('*/').length;
            if(src.substr(doc.cursor[0], doc.cursor[1] - doc.cursor[0]).indexOf('/*') == -1) {
              doc.e_idx = doc.cursor[1]; break;
            }
            doc.cursor[0] = doc.cursor[1];
          }
          // @public/@private から終わりまで
          // 最終行は無視される。
          let Lno;
          let a_def; // Active definition
          const Lines = src.substr(doc.s_idx, doc.e_idx - doc.s_idx).split(/\r\n|\r|\n/).slice(0, -1).map((t, L_idx)=>{
            
            Lno = L_idx + 1;
            // console.log(`Line no ${Lno} text? ${t}`);
            t = t.replace(/^[\s\t]+\*/, '').replace(kwd, '');
            Kws.Tags.forEach(tag=>{
              if(t.indexOf(tag + ' ') != -1 || new RegExp(tag + '$').test(t)) {
                doc.tags.push(tag);
                t = t.replace(tag, '');
                return;
              }
            });
            Kws.Defs.forEach((def, idx)=>{
              const defa = doc.defs[def] = doc.defs[def] || [ ];
              const defe = defa[ defa.length - 1 ] || { };
              if(t.indexOf(def + ' ') != -1 || new RegExp(def + '$').test(t)) { // @name と @namespace を区別したい。コンテンツ
                if(a_def && a_def.Lno_e == NULL) {
                  // クローズされていない definition があればクローズ
                  a_def.Lno_e = Lno - 1;
                }
                defa.push(a_def = { Lno_s: Lno, contents: [ ] });
                t = t.replace(def, '');
                return;
              }
              if(defe.Lno_s && defe.Lno_e == NULL) {
                a_def = defe;
                return;
              }
            });
            t = t.trim();
            if(a_def) {
              !t || a_def.contents.push(t);
            }
            return t;

          }).filter(t=>!!t);
          if(a_def) {
            a_def.Lno_e = Lno - 1;
          }
          // and substitute name, async tag if the next line includes "function"
          const nextText = String(src[a_def.Lno_e]);
          const mtc = nextText.match(/\s*(async\s+)?function(\s+[\w_]+)?\(/);
          if(mtc) {
            if(mtc[1] && !doc.tags.includes('@async')) {
              doc.tags.push('@async');
            }
            if((mtc[2] || mtc[0].split('=').length > 1) && doc.defs['@name'].length == 0) {
              doc.defs['@name'].push({
                Lno_s: a_def.Lno_e, 
                contents: [ mtc[2] || mtc[0].split('=')[0].split(/\s/).filter(t=>!!t)[1] ], 
                Lno_e: a_def.Lno_e
              });
            }
          }

        }
        // <-- while( (pos = ... ) ) { ... } <--
      });
      // <-- [ ].forEach(kwd=>{ ... }) <--
      // ここまでで、@public/@private に関してのブロック抽出（docs）が完了する。
      // docs.forEach((doc_v, doc_i)=>console.log(`[${('00' + (doc_i + 1)).substr(-3)}]`, JSON.stringify(doc_v, NULL, '  ')));
      Logger.info(`Finished extracting ${docs.length} document(s) from ${file}.`);
      return docs;

    });
  }
})(this);

