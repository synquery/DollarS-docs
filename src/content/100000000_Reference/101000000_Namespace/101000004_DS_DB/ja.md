---
alias: DS_DB
desc_key: 101000004_DS_DB
level: 2
parent: 100000000_Reference
title: DS
top: undefined
---

<span class="tag"> readonly </span><span class="tag"> constant </span>

<code>$S.DB</code> はオンライン(Ajax, WebSocket)・オフライン(Hash, localStorage, indexedDB) をトータルでサポートする、コネクタです。
synquery のバックエンドと通信を行うためには <code>$S.DB</code> を元に生成されたインスタンスの API をコールします。
