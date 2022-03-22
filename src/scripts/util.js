/**
 * [DollarS-docs] scripts/util.js
 * 複数の script から利用するユーティリティ関数
 */
const NULL = null, TRUE = true, FALSE = false, UNDEF = undefined;
const fs = require('fs'), fm = require('front-matter');
const EOL = "\r\n";
(g=>{ // g === module.exports

  let Logger; // Assign when getLogger is called
  Object.assign(module.exports, { 
    seekDir, hasDoc, fixDoc, crtDoc,
    getLogger
  });

  /**
   * @public
   */
  async function seekDir(topDir) {
    // topDir は含めず、洗い出しを行う。
    const rd = {
      directories: [ ]
    };
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
      fs.readdirSync(dir).forEach(nam=>{
        const fp = [ dir, nam ].join('/');
        const stat = fs.statSync(fp);
        if(!stat) throw `Unexpected pathname stat at ${fp}`;
        if (stat.isDirectory()) {
          when = when.then(()=>one(fp, isTop ? 0: (lev + 1)));
          return;
        }
        dirObj.files.push({
          name: nam, filepath: fp
        });
      });
      return when;

    };
    return one(topDir).then(()=>rd);
  }

  /**
   * @public
   */
  function hasDoc(d, ln) {
    let stat; try { stat = fs.statSync(mdfp(d, ln)); } catch(e) { if(e.code != 'ENOENT') throw e; }
    return stat && stat.isDirectory() === FALSE;
  }

  /**
   * @public
   */
  async function fixDoc(d, ln, tocObj) {
    return Promise.resolve().then(()=>{
      return fmedFile({ d, ln, tocObj }, FALSE);
    })['catch'](e=>{
      Logger.error(`fixDoc(ln=${ln}):`, e);
      throw e;
    });
  }

  /**
   * @public
   */
  async function crtDoc(d, ln, tocObj) {
    return Promise.resolve().then(()=>{
      return fmedFile({ d, ln, tocObj }, TRUE);
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
   * @private
   */
  function mdfp(d, ln) {
    return `${d.dirpath}/${ln}.md`;
  }
  
  /**
   * @private
   */
  function fmedFile({ d, ln, tocObj }, is_new) {
    const fp = mdfp(d, ln), getFm = ()=>fm(fs.readFileSync(fp).toString('utf-8'));
    const content = is_new ? { }: getFm();
    const attr = content.attributes = content.attributes || { };
    // Overwrite to fix relation
    attr.alias = tocObj.alias;
    attr.desc_key = tocObj.desc_key;
    attr.lang = ln;
    // Inherit if exist
    attr.title = attr.title || tocObj.alias;
    let s = "";
    s += "---" + EOL;
    s += Object.keys(attr).sort((k1, k2)=>k1.localeCompare(k2)).map(k => `${k}: ${attr[k]}`).join(EOL) + EOL;
    s += "---" + EOL;
    s += EOL;
    s += (is_new ? "": content.body);
    fs.writeFileSync(fp, s);
    return getFm().attributes;
  }
  
  const stripLinks = (line) => {
    return line.replace(/\[([^\]]+)\]\([^)]+\)/, (match, p1) => p1)
  }
  
})(this);
