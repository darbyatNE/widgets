---
title: TapIt — Reaction Game
toc: false
---

<link rel="stylesheet" href="./components/tapit.css">

<main class="tapit-app" id="tapit-root" aria-label="TapIt reaction game"></main>

```js
import {mountTapIt} from "./components/tapit.js";
const stopTapIt = mountTapIt(document.querySelector("#tapit-root"), {invalidation});
invalidation.then(stopTapIt);
```
