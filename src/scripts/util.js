/**
 * [DollarS-docs] scripts/util.js
 * 複数の script から利用するユーティリティ関数
 */
const NULL = null, TRUE = true, FALSE = false, UNDEF = undefined;
const fs = require('fs'), fm = require('front-matter');
const crypto = require("crypto");
const yaml = require('js-yaml');
const EOL = "\r\n";
(g=>{ // g === module.exports

  let Logger; // Assign when getLogger is called
  Object.assign(module.exports, {
    path, charFix, config,
    seekDir, hasDoc, fixDoc, crtDoc,
    getLogger, getContentHash,
    getVal, setVal, delVal, hasVal,
    is, isFunction, isArray
  });

  /**
   * @public
   */
  function path(p, r) {
    return require('path').resolve(r || __dirname, p);
  }
  
  /**
   * @public
   */
  function charFix(c) {
    return ( isArray(c) ? c.join(''): c ).split('').map(c=>c == '$' ? 'D': /^[\w_]$/.test(c) ? c: '_').join('');
  }
  
  /**
   * @public
   */
  function config(cp) {
    const obj = yaml.load(fs.readFileSync(path(cp || '../config/config.yml'), 'utf8'));
    if(!isArray(obj.wln)) {
      throw `key "wln" (writing languages) must be an array of language codes`;
    }
    if(!isArray(obj.aln) || obj.aln.filter(ln=>!obj.wln.includes(ln)).length) {
      throw `key "aln" (available languages) must be an array of language codes include in key "wln"`;
    }
    if(!is('string', obj.defln) || !obj.aln.includes(obj.defln)) {
      throw `key "defln" (default language) must be a string language code includes in key "aln"`;
    }
    const scrs = obj.scripts = obj.scripts || { };
    if(!hasVal(scrs.docsdir)) scrs.docsdir = '../content';
    if(!hasVal(scrs.distdir)) scrs.distdir = '../dist';
    return obj;
  }
  
  /**
   * @public
   */
  async function seekDir(topDir, options) {
    // topDir は含めず、洗い出しを行う。
    const rd = {
      directories: [ ]
    };
    const opts = Object.assign({ patterns: [ ], filterEmpty: FALSE }, options);
    const rptn = opts.patterns.length == 0 ? NULL: new RegExp('^(' + opts.patterns.join('|').replace(/\*/, ".*") + ')$');
    const one = async (dir, lev) => {

      const isTop = lev == NULL;
      const dirObj = {
        name: dir.split('/').pop(), 
        dirpath: dir, level: lev, files: [ ]
      };
      if(!isTop) {
        rd.directories.push(dirObj);
      }

      let when = Promise.resolve();
      fs.readdirSync(path(dir)).forEach(nam=>{
        const fp = [ dir, nam ].join('/');
        const stat = fs.statSync(fp);
        if(!stat) throw `Unexpected pathname stat at ${fp}`;
        if(stat.isDirectory()) {
          when = when.then(()=>one(fp, isTop ? 0: (lev + 1)));
          return;
        }
        if(rptn && !rptn.test([ dirObj.name, nam ].join('/'))) {
          return;
        }
        dirObj.files.push({
          name: nam, filepath: fp
        });
      });
      return when.then(()=>{
        if(!isTop && opts.filterEmpty && dirObj.files.length == 0) {
          rd.directories.splice(rd.directories.indexOf(dirObj), 1);
        }
      });

    };
    return one(topDir).then(()=>rd);
  }

  /**
   * @public
   * @param <object> d
   *  ja: ディレクトリのパラメータを設定したオブジェクト
   * @param <string> ln
   *  ja: 言語コード
   */
  function hasDoc(d, ln) {
    let stat; try { stat = fs.statSync(mdfp(d, ln)); } catch(e) { if(e.code != 'ENOENT') throw e; }
    return stat && stat.isDirectory() === FALSE;
  }

  /**
   * @public
   */
  async function fixDoc(d, ln, tocObj, bdyDoc) {
    return Promise.resolve().then(()=>{
      return fmedFile({ d, ln, tocObj, bdyDoc }, FALSE);
    })['catch'](e=>{
      Logger.error(`fixDoc(ln=${ln}):`, e);
      throw e;
    });
  }

  /**
   * @public
   */
  async function crtDoc(d, ln, tocObj, bdyDoc) {
    return Promise.resolve().then(()=>{
      return fmedFile({ d, ln, tocObj, bdyDoc }, TRUE);
    })['catch'](e=>{
      Logger.error(`crtDoc(ln=${ln}):`, e);
      throw e;
    });
  }
  
  /**
   * @public
   */
  function getLogger(filename) {
    const pfix = ty=>`${new Date().toLocaleString()} - [${filename}][${ty}]`;
    return Logger = {
      info : function() { 
        console.log.apply(console, [pfix('I')].concat( Array.from(arguments) ));
      },
      error: function() {
        console.log.apply(console, [pfix('E')].concat( Array.from(arguments) ));
      }
    }; 
  }
  
  /**
   * @public
   */
  function getContentHash(d, ln) {
    const cipher = crypto.createHash('sha256').update(fs.readFileSync(mdfp(d, ln)), 'utf-8');
    return cipher.digest('hex');
  }
    
  /**
   * @private
   */
  function mdfp(d, ln) {
    return `${d.dirpath}/${ln}.md`;
  }
  
  /**
   * @private
   */
  function fmedFile({ d, ln, tocObj, bdyDoc }, is_new) {
    const fp = mdfp(d, ln), getFm = ()=>fm(fs.readFileSync(fp).toString('utf-8'));
    const content = is_new ? { }: getFm();
    const attr = content.attributes = content.attributes || { };
    // Overwrite to fix relation
    [ 'alias', 'level', 'desc_key', 'parent', 'top' ].forEach(k=>attr[k] = tocObj[k]);
    // Inherit if exist
    attr.title = attr.title || tocObj.alias;
    let s = "";
    s += "---" + EOL;
    s += Object.keys(attr).sort((k1, k2)=>k1.localeCompare(k2)).map(k => `${k}: ${attr[k]}`).join(EOL) + EOL;
    s += "---" + EOL;
    s += EOL;
    s += bdyDoc == NULL ? (is_new ? "": content.body): bdyDoc;
    fs.writeFileSync(fp, s);
    return getFm().attributes;
  }
  
  const stripLinks = (line) => {
    return line.replace(/\[([^\]]+)\]\([^)]+\)/, (match, p1) => p1)
  }
  
  // ---
  /**
   * @public @exports getVal
   */
  function getVal(obj, key) {
    let i, k = key.split(".");
    for(i = 0, v = obj; i < k.length; i++) {
      if(v[k[i]] == NULL) return v[k[i]]; // null or undefined
      v = v[k[i]];
    }
    return v;
  }
  
  /**
   * @public @exports setVal
   */
  function setVal(obj, key, val) {
    if(!obj) throw `Cannot set ${key} to non-object`;
    let i, v, k = key.split("."), sa, nk, lk = k.pop();
    let is_idx;
    for(i = 0, v = obj; i < k.length; i++) {
      nk = String(k[i + 1] || lk);
      is_idx = parseInt(nk) == nk && 0 <= nk && 999 >= nk; // For YEAR + MONTH KEY (MAX INDEX:999)
      if(v[k[i]] == NULL) {
        v[k[i]] = is_idx ? [ ]: { };
      } else if(isArray(v[k[i]]) && !is_idx) {

        // If the type is changed, convert array to object
        sa = v[k[i]];
        v[k[i]] = {};
        sa.forEach(function(sv, si) {
          if(!is('undefined', sv)) v[k[i]][String(si)] = sv;
        });

      }
      v = v[k[i]];
    }
    return v[lk] = val;
  }
  
  /**
   * @public @exports delVal
   *  ja: setVal の unset 版
   *  キーがない場合は無視、あれば削除（カンマ区切りなしの場合もあり）
   * @param <Object> obj
   *  ja: 値を削除するオブジェクト 
   * @param <String> key
   *  ja: 削除するキー。deep_only を指定すると "." で繋いだ階層を潜って削除することも可能
   * @param <Boolean> deep_only
   *  ja: 潜っての削除を許可しない場合
   * @return <Boolean> deleted
   *  ja: キーが削除されれば true, されなければ false
   */
  function delVal(obj, key, deep_only) {
    if(!obj) return FALSE;
    if(!deep_only) return delete obj[key]; // 直ちに処理を終了し、高速に動作する。
    let i, v, k = key.split("."), nk, lk = k.pop();
    for(i = 0, v = obj; i < k.length; i++) {
      if(v[nk = k[i]] == NULL) return FALSE; // 最後までたどり着けなかった場合終了
      v = v[nk];
    }
    if(is('object', v) || is('array', v)) return delete v[lk];
    return FALSE;
  }

  /**
   * @jsdoc 100000000_Reference/
   * @public @exports
   * ja: 値の有無を判定する。JavaScript の falsy 判定から 0 と false を除いたものを「値なし」と見做す。
   * @param <Any> v
   * ja: 判定対象の値
   * @returns <Boolean> j
   * ja: 判定結果 true:値あり false:値なし
   */
  function hasVal(v) {
    return !!v || v === 0 || v === FALSE;
  }
  
  // ---
  /**
   * @public @exports
   */
  function is(ty, x) {
    return ty == (x === UNDEF ? 'undefined': x == NULL ? 'null': Array.isArray(x) ? 'array': typeof x);
  }
  /**
   * @public
   */
  function isFunction(x) {
    return is('function', x);
  }
  /**
   * @public
   */
  function isArray(x) {
    return is('array', x);
  }
  
})(this);
