/**
 * [DollarS-docs] scripts/document-json-builder.js
 * config の jsdoc を作成、
 * config および content のファイル内容から各ドキュメントの SHA-256 ハッシュを作成する。
 * それぞれの front-matter にハッシュ値を追加の上、output フォルダ（デフォルト:dist）にアップロード用の json ファイルを生成する。
 * アップロードでは飽くまで「extend」が前提。記述のない言語についてはキーを作成しない。
 */
const NULL = null, TRUE = true, FALSE = false, UNDEF = undefined;
const fs = require("fs"), fm = require('front-matter'), cp = require("child_process");
const u = require("./util.js");
const Logger = u.getLogger(__filename.split('/').pop());

const config = u.config();
(async g=>{ // g === global
  const doc_key = config.doc_key;
  const defLng = config.defln;
  const scrs = config.scripts;
  const docsdir = u.path(scrs.docsdir);
  const distdir = u.path(scrs.distdir);
  const title_json = [ ], desc_json = [ ];
  await Promise.resolve().then(()=>{
    
    // (1) distdir から dist フォルダを再作成
    cp.execSync(`rm -Rf ${distdir} && mkdir -p ${distdir}`);
    
    // (2) md ファイルを探索して、title データ、desc データを作成していく。
    Logger.info('Gathering markdown docs ...');
    return u.seekDir(docsdir, { patterns: [ '*.md' ], filterEmpty: TRUE }).then(r=>{
      Logger.info(`Found ${r.directories.length}  directories, ${[ 0 ].concat(r.directories.map(d=>d.files.length)).reduce((p, c)=>p + c)} files`);
      let when = Promise.resolve();
      // js ファイルディレクトリが r.directories 分見つかったことになる。
      r.directories.forEach((d, idx)=>{
        const tObj = { doc_key, role: 'title', 
          title: { }, top: NULL, update: NULL, _id: UNDEF };
        const dObj = { doc_key, role: 'desc', 
          desc: { }, update: NULL, _id: UNDEF, origin: UNDEF /*コピー元*/ };
        d.files.forEach(file=>{
          // 言語ごとのファイルが処理される
          const ln = file.name.replace('.md', '');
          when = when.then(()=>fm(fs.readFileSync(file.filepath).toString('utf-8'))).then(({ attributes, body })=>{
            if(ln == defLng) {
              tObj.title[ln] = attributes.title;
              dObj.desc[ln] = body;
              tObj.level = attributes.level;
              tObj.alias = attributes.alias;
              tObj.desc_key = attributes.desc_key; // parent を確定させるために統一的に desc_key と同じにする
              tObj.order = attributes.desc_key.split('_')[0];
              tObj.parent = attributes.parent;
              tObj.top = attributes.top;
              tObj.title.global = attributes.title;
              tObj._id = [ 't', attributes.desc_key ].join('_');
              dObj.key = attributes.desc_key;
              dObj.desc.global = body;
              dObj._id = [ 'd', attributes.desc_key ].join('_');
            } else {
              // 値がある時のみ作成する。
              //（それ以外の場合は現在の保存値のままとなる）
              if(String(attributes.title || '').trim()) tObj.title[ln] = attributes.title;
              if(String(body || '').trim()) dObj.desc[ln] = body;
            }
          });
        });
        when.then(()=>{
          title_json.push(tObj);
          desc_json.push(dObj);
        });
      });
      return when;
    });
    
  }).then(()=>{
    
    // _id 重複確認
    const _ids = new Set();
    title_json.forEach(t=>{ 
      if(_ids.has(t._id)) { throw `Duplicated title _id ${t._id}`; }
      _ids.add(t._id);
    });
    desc_json.forEach(d=>{ 
      if(_ids.has(d._id)) { throw `Duplicated description _id ${d._id}`; }
      _ids.add(d._id);
    });

    // (3) json ファイルの書き出し
    const jsonPath = ty=>[ distdir, ty + '.json' ].join('/');
    const jsonText = ar=>'[' + ar.map(obj=>JSON.stringify(obj)).join("\n,") + '\n]';
    fs.writeFileSync(jsonPath('title'      ), jsonText(title_json));
    fs.writeFileSync(jsonPath('description'), jsonText(desc_json ));

  }).then(()=>{
    Logger.info('Complete');
  })['catch'](e=>{
    Logger.error('Failure', e);
  });
  return;
})(this);

