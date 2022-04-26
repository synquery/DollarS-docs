---
alias: DS
desc_key: 101000003_DS
level: 2
parent: 100000000_Reference
title: DS
top: undefined
---

<span class="tag"> readonly </span><span class="tag"> constant </span>

Synquery バックエンドと通信を行うためのトップレベルドメイン。
Synquery.$S と同じく、ブラウザ(window) やワーカー(self) のグローバル領域にセットされており、直接参照できます。
また、$S 自体はイベントを授受することができ、アプリケーションの状態によって、所定のイベントを受け取ります。
<b>- $Sの受け取るイベント</b>
| message | $S に紐付けされている Websocket や Ajax から受け取るメッセージです。|
| error   | $S に紐付けされている Websocket や Ajax から受け取るエラーです。|
| online  | オンラインに切り替わった時に受け取ります。|
| offline | オフラインに切り替わった時に受け取ります。|
