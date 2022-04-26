---
alias: SynqueryCondition
desc_key: 101000002_SynqueryCondition
level: 2
parent: 100000000_Reference
title: SynqueryCondition
top: undefined
---

<span class="tag"> readonly </span><span class="tag"> constant </span>

Synquery を立ち上げたブラウザにおける、Synquery が利用する Web テクノロジーの実装状況の一覧です。
分類キーに続き、それぞれのステータスがわかります。
| 分類キー | 説明|
| --- | ---|
| require  | Synquery の起動に必須のブラウザ API 一覧です。|
| support  | Synquery システム稼働の前提条件となるブラウザ API ですが、非対応ブラウザに対しても RSD を読み込んで補うことができるものの一覧です。|
| localize | Synquery をクラウドレスで起動（=オフラインアプリケーション起動）を行う際に必要となるブラウザ API です。|
| extra    | アプリケーションの実装に有用なブラウザ API の一覧です。|
| short    | require, support, localize, extra の各キーでブラウザが未実装の数を一覧しています。|
|          | require が 1以上の場合、Synquery は正しい挙動ができません。|
|          | また、 localize が 1以上の場合、クラウドレスな起動に支障が出る場合があります。|
