/**
 * [DollarS-docs] scripts/generate-frontmatted-mds.js
 * config および content のファイル内容から、content 内に frontmatter 付与済の .md ファイルを生成する。
 * 既に作成済の .md については frontmatter のみ修正、想定外の .md については、終了後にリストを出力する。
 */
const NULL = null;
const fs = require("fs"), path = p=>require('path').resolve(__dirname, p);
const yaml = require('js-yaml');
const u = require("./util.js");
const Logger = u.getLogger(__filename.split('/').pop());

const config = yaml.load(fs.readFileSync(path('../config/config.yml'), 'utf8'));
const toc = { }, desc = { };
const pos = [0, 0, 0, 0, 0], tis = [ ];
(async g=>{ // g === global
  await Promise.resolve().then( ()=>u.seekDir(path('../content')) ).then(r=>{

    let when = Promise.resolve();
    // seekDir は directory と markdown ファイルの全列挙を行う
    // Loop process for each directory
    r.directories.forEach((d, idx)=>{
      // Logger.info(`[${('0000' + idx).substr(-4)}] Listup directories:`, d);
      const pair = d.name.split('_');
      const role = 'title', desc_key = pair[1].toLowerCase();
      if(toc[ desc_key ] != NULL) {
        throw `Duplicated desc_key ${desc_key} for order ${toc[ desc_key ].order} and ${pair[0]}`;
      }
      const tocObj = toc[ pair[0] ] = { 
        doc_key: config.doc_key, 
        role, desc_key,
        alias: pair[1], order: pair[0],
        level: d.level, title: { global: NULL }
      };
      // Loop process for each writing language
      config.wln.forEach(ln=>{
        tocObj.title[ ln ] = NULL;
        when = when.then(()=>u.hasDoc(d, ln) ? u.fixDoc(d, ln, tocObj): u.crtDoc(d, ln, tocObj)).then((attr = { })=>{
          tocObj.title[ ln ] = attr.title;
          if(config.def_ln == ln) { tocObj.title[ 'global' ] = attr.title; }
        });
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
})(this);
