/**
 * [DollarS-docs] scripts/document-json-builder.js
 * config および content のファイル内容から、dist フォルダ内に config.json, title.json, description.json を出力する。
 * 引数に日付を与えることで、更新分だけを取得できるようにする。
 * ただし、削除対象はわからないので、定期的に丸っと入れ替える方がデータは綺麗になる。
 */
const fs = require("fs");
const u = require("./util.js");

const config = yaml.load(fs.readFileSync('../config/config.yml', 'utf8'));
const toc = { }, desc = { };
const pos = [0, 0, 0, 0, 0];
(g=>{ // g === global
  
  // seekDir は directory と markdown ファイルの全列挙を行う
  u.seekDir().then(r=>{

    let when = Promise.resolve();
    r.directories.forEach(d=>{
      config.wln.forEach(ln=>{
        when = when.then(()=>u.hasDoc(d, ln) ? u.fixDoc(d, ln): u.crtDoc(d, ln));
      });
    });
    return when;

  }).then(()=>{
    
  })['catch'](e=>{
    
  });
  // <-- END_OF_MAIN <--

})(this);

/*
const addHeaderID = (line, slugger, write = false) => {
  // check if we're a header at all
  if (!line.startsWith("#")) {
    return line
  }
  // check if it already has an id
  if (/\{#[^}]+\}/.test(line)) {
    return line
  }
  const headingText = line
    .slice(line.indexOf(" "))
    .replace(/\{#[^}]+\}/, "")
    .trim()
  const headingLevel = line.slice(0, line.indexOf(" "))
  curLevel[headingLevel.length - 1]++
  for (let l = headingLevel.length; l < 3; l++) {
    curLevel[l] = 0
  }
  const headerNumber = curLevel.join(".")
  let slug = null
  if (!write) {
    // const match = /^.+(\s*\{#([A-Za-z0-9\-_]+?)\}\s*)$/.exec(line);
    // slug = match ? match[2].toLowerCase() : slugger.slug(stripLinks(headingText));
    slug = slugger.slug(stripLinks(headingText))
    toc[headerNumber] = {
      text: headingText,
      slug,
    }
    // The below code is for printing the anchor link reference
    // const title = headingText.replace(/^\d\.\s+/, '').trim()
    // if (curLevel[1] > 0)
    // console.log(`  ${curLevel[1]}. [${title}](#${slug})`);
  } else {
    if (headerNumber in toc) {
      slug = toc[headerNumber].slug
      console.log("\twrite heading ID", headerNumber, headingText, "==>", slug)
      return `${headingLevel} ${headingText} {#${slug}}`
    } else {
      console.log(
        "\theaderNumber not found",
        headerNumber,
        headingText,
        "==>",
        slug
      )
      return line
    }
  }
}

const addHeaderIDs = (lines, write = false) => {
  // Sluggers should be per file
  const slugger = new GitHubSlugger()
  let inCode = false
  const results = []
  lines.forEach((line) => {
    // Ignore code blocks
    if (line.startsWith("```")) {
      inCode = !inCode
      results.push(line)
      return
    }
    if (inCode) {
      results.push(line)
      return
    }

    results.push(addHeaderID(line, slugger, write))
  })
  return results
}

const traverseHeaders = (path, doc = "", write = false) => {
  const files = walk(path, doc)
  files.forEach((file) => {
    if (!file.endsWith(".md")) {
      return
    }

    console.log(`>>> processing ${file}`)
    curLevel = [0, 0, 0]
    const content = fs.readFileSync(file, "utf8")
    const lines = content.split("\n")
    const updatedLines = addHeaderIDs(lines, write)
    if (write) {
      fs.writeFileSync(file, updatedLines.join("\n"))
    }
  })
  if (!write) {
    console.log(toc)
  }
}

const addHeaderIDsForDir = (path) => {
  if (path.includes("translations")) {
    throw new Error(`Heading ID generation is intended for English files only.`)
  }
  const fullPath = `src/content/${path}`
  traverseHeaders(fullPath, null, false)
  traverseHeaders(fullPath, null, true)
}

const [path] = process.argv.slice(2)

addHeaderIDsForDir(path)
*/
