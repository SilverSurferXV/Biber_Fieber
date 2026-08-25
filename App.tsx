import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { GlobalContextProviders } from "./components/_globalContextProviders";
import Page_0 from "./pages/shop.tsx";
import PageLayout_0 from "./pages/shop.pageLayout.tsx";
import Page_1 from "./pages/about.tsx";
import PageLayout_1 from "./pages/about.pageLayout.tsx";
import Page_2 from "./pages/admin.tsx";
import PageLayout_2 from "./pages/admin.pageLayout.tsx";
import Page_3 from "./pages/login.tsx";
import PageLayout_3 from "./pages/login.pageLayout.tsx";
import Page_4 from "./pages/_index.tsx";
import PageLayout_4 from "./pages/_index.pageLayout.tsx";
import Page_5 from "./pages/fahrer.tsx";
import PageLayout_5 from "./pages/fahrer.pageLayout.tsx";
import Page_6 from "./pages/account.tsx";
import PageLayout_6 from "./pages/account.pageLayout.tsx";
import Page_7 from "./pages/checkout.tsx";
import PageLayout_7 from "./pages/checkout.pageLayout.tsx";
import Page_8 from "./pages/liefergebiet.tsx";
import PageLayout_8 from "./pages/liefergebiet.pageLayout.tsx";
import Page_9 from "./pages/sonderbereich.tsx";
import PageLayout_9 from "./pages/sonderbereich.pageLayout.tsx";
import Page_10 from "./pages/passwort-reset.tsx";
import PageLayout_10 from "./pages/passwort-reset.pageLayout.tsx";
import Page_11 from "./pages/aufladen.$token.tsx";
import PageLayout_11 from "./pages/aufladen.$token.pageLayout.tsx";

if (!window.requestIdleCallback) {
  window.requestIdleCallback = (cb) => {
    setTimeout(cb, 1);
  };
}

import "./base.css";

const fileNameToRoute = new Map([["./pages/shop.tsx","/shop"],["./pages/about.tsx","/about"],["./pages/admin.tsx","/admin"],["./pages/login.tsx","/login"],["./pages/_index.tsx","/"],["./pages/fahrer.tsx","/fahrer"],["./pages/account.tsx","/account"],["./pages/checkout.tsx","/checkout"],["./pages/liefergebiet.tsx","/liefergebiet"],["./pages/sonderbereich.tsx","/sonderbereich"],["./pages/passwort-reset.tsx","/passwort-reset"],["./pages/aufladen.$token.tsx","/aufladen/:token"]]);
const fileNameToComponent = new Map([
    ["./pages/shop.tsx", Page_0],
["./pages/about.tsx", Page_1],
["./pages/admin.tsx", Page_2],
["./pages/login.tsx", Page_3],
["./pages/_index.tsx", Page_4],
["./pages/fahrer.tsx", Page_5],
["./pages/account.tsx", Page_6],
["./pages/checkout.tsx", Page_7],
["./pages/liefergebiet.tsx", Page_8],
["./pages/sonderbereich.tsx", Page_9],
["./pages/passwort-reset.tsx", Page_10],
["./pages/aufladen.$token.tsx", Page_11],
  ]);

function makePageRoute(filename: string) {
  const Component = fileNameToComponent.get(filename);
  return <Component />;
}

function toElement({
  trie,
  fileNameToRoute,
  makePageRoute,
}: {
  trie: LayoutTrie;
  fileNameToRoute: Map<string, string>;
  makePageRoute: (filename: string) => React.ReactNode;
}) {
  return [
    ...trie.topLevel.map((filename) => (
      <Route
        key={fileNameToRoute.get(filename)}
        path={fileNameToRoute.get(filename)}
        element={makePageRoute(filename)}
      />
    )),
    ...Array.from(trie.trie.entries()).map(([Component, child], index) => (
      <Route
        key={index}
        element={
          <Component>
            <Outlet />
          </Component>
        }
      >
        {toElement({ trie: child, fileNameToRoute, makePageRoute })}
      </Route>
    )),
  ];
}

type LayoutTrieNode = Map<
  React.ComponentType<{ children: React.ReactNode }>,
  LayoutTrie
>;
type LayoutTrie = { topLevel: string[]; trie: LayoutTrieNode };
function buildLayoutTrie(layouts: {
  [fileName: string]: React.ComponentType<{ children: React.ReactNode }>[];
}): LayoutTrie {
  const result: LayoutTrie = { topLevel: [], trie: new Map() };
  Object.entries(layouts).forEach(([fileName, components]) => {
    let cur: LayoutTrie = result;
    for (const component of components) {
      if (!cur.trie.has(component)) {
        cur.trie.set(component, {
          topLevel: [],
          trie: new Map(),
        });
      }
      cur = cur.trie.get(component)!;
    }
    cur.topLevel.push(fileName);
  });
  return result;
}

function NotFound() {
  return (
    <div>
      <h1>Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>Go back to the <a href="/" style={{ color: 'blue' }}>home page</a>.</p>
    </div>
  );
}

import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "REPLACE" | "POP"

  useEffect(() => {
    // Back/forward: keep browser-like behavior
    if (navType === "POP") return;

    // Hash links: let the browser scroll to the anchor
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, hash, navType]);

  return null;
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
      <ScrollManager />
      <GlobalContextProviders>
        <Routes>
          {toElement({ trie: buildLayoutTrie({
"./pages/shop.tsx": PageLayout_0,
"./pages/about.tsx": PageLayout_1,
"./pages/admin.tsx": PageLayout_2,
"./pages/login.tsx": PageLayout_3,
"./pages/_index.tsx": PageLayout_4,
"./pages/fahrer.tsx": PageLayout_5,
"./pages/account.tsx": PageLayout_6,
"./pages/checkout.tsx": PageLayout_7,
"./pages/liefergebiet.tsx": PageLayout_8,
"./pages/sonderbereich.tsx": PageLayout_9,
"./pages/passwort-reset.tsx": PageLayout_10,
"./pages/aufladen.$token.tsx": PageLayout_11,
}), fileNameToRoute, makePageRoute })} 
          <Route path="*" element={<NotFound />} />
        </Routes>
      </GlobalContextProviders>
    </BrowserRouter>
  );
}
