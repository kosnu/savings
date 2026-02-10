import{j as o}from"./iframe-dHABiMeZ.js";import{f as n}from"./test-dBchXaWu.js";import{F as m,i as c}from"./store-BDQXzfpO.js";import{p}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as d,u as r,i as u}from"./signInByMockUser-Bq6j-viy.js";import{i as f}from"./insertPayments-CDX4R2OH.js";import{M as l}from"./MonthlyTotals-Dw_R9IHI.js";import{M as y}from"./chunk-JZWAC4HX-CBO1G18r.js";import"./preload-helper-PPVm8Dsz.js";import"./react-error-boundary-C3Blex15.js";import"./toCurrency-B1XOnn-n.js";import"./useQuery-Dir4VHnT.js";import"./useDateRange-BNCrmCFV.js";import"./startOfMonth-CUyQgTrU.js";import"./toDate-SX-ecmdR.js";import"./text-CUfpPkrv.js";import"./skeleton-CXonK7rb.js";const{expect:s,within:T}=__STORYBOOK_MODULE_TEST__,R={title:"Features/SummaryByMonth/MonthlyTotals",component:l,tags:["autodocs"],beforeEach:async()=>{const{firestore:t,auth:e}=c(n);await d(e,r);const i=e.currentUser?.uid??r.id;await u(t,{...r,id:i}),await f(e,t,p)},decorators:t=>o.jsx(y,{initialEntries:["/payments?year=2025&month=04"],children:o.jsx(m,{config:n,children:o.jsx(t,{})})})},a={play:async({canvasElement:t})=>{const e=T(t);s(await e.findByText("Total spending")).toBeInTheDocument(),s(await e.findByText("￥4,000")).toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("Total spending")).toBeInTheDocument();
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument();
  }
}`,...a.parameters?.docs?.source}}};const P=["Default"];export{a as Default,P as __namedExportsOrder,R as default};
