import{j as a}from"./iframe-dHABiMeZ.js";import{g as u}from"./react.esm-DslVtTgX.js";import{f as c}from"./test-dBchXaWu.js";import{F as f,i as y}from"./store-BDQXzfpO.js";import{c as m}from"./categories-CMvCyqKA.js";import{p as d}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as T,u as i,i as g}from"./signInByMockUser-Bq6j-viy.js";import{i as x}from"./insertCategories-B0Xk4IxW.js";import{i as B}from"./insertPayments-CDX4R2OH.js";import{S as l}from"./Summary-CsOXWBnS.js";import{M as h}from"./chunk-JZWAC4HX-CBO1G18r.js";import{p as w}from"./container-IyyOPDwT.js";import"./preload-helper-PPVm8Dsz.js";import"./client-CTlwWJaA.js";import"./Accordion-D4a1Yify.js";import"./index-CUv62izO.js";import"./reset-ELlVgqbp.js";import"./require-react-element-xuZeOgzx.js";import"./CategoryTotals-BLmxM1lF.js";import"./toCurrency-B1XOnn-n.js";import"./useCategories-BcMKRyaV.js";import"./useQuery-Dir4VHnT.js";import"./usePayments-BgRaBHz2.js";import"./useDateRange-BNCrmCFV.js";import"./startOfMonth-CUyQgTrU.js";import"./toDate-SX-ecmdR.js";import"./text-CUfpPkrv.js";import"./MonthlyTotals-Dw_R9IHI.js";import"./react-error-boundary-C3Blex15.js";import"./skeleton-CXonK7rb.js";import"./card-Bj6pjYUl.js";import"./get-subtree-B5itu7Ql.js";const{expect:o}=__STORYBOOK_MODULE_TEST__,tt={title:"Features/SummaryByMonth/Summary",component:l,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{},beforeEach:async()=>{const{firestore:e,auth:n}=y(c);await T(n,i);const t=n.currentUser?.uid??i.id;await g(e,{...i,id:t}),await x(n,e,m),await B(n,e,d)},decorators:e=>a.jsx(h,{initialEntries:["/payments?year=2025&month=06"],children:a.jsx(f,{config:c,children:a.jsx(w,{size:"4",children:a.jsx(e,{})})})})},r={play:async({canvasElement:e,userEvent:n})=>{const t=u(e);o(await t.findByText("Total spending")).toBeInTheDocument(),o(await t.findByText("￥5,000")).toBeInTheDocument();const s=t.getByRole("button",{name:/by category/i});o(s).toBeInTheDocument(),await n.click(s);for(const p of Object.values(m))o(await t.findByText(p.name)).toBeInTheDocument();o(await t.findByText("Unknown")).toBeInTheDocument(),o(await t.findByText("￥4,000")).toBeInTheDocument(),o(await t.findAllByText("￥0")).toHaveLength(2)}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    userEvent
  }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("Total spending")).toBeInTheDocument();
    expect(await canvas.findByText("￥5,000")).toBeInTheDocument();
    const accordionTrigger = canvas.getByRole("button", {
      name: /by category/i
    });
    expect(accordionTrigger).toBeInTheDocument();
    await userEvent.click(accordionTrigger);
    for (const category of Object.values(categories)) {
      expect(await canvas.findByText(category.name)).toBeInTheDocument();
    }
    expect(await canvas.findByText("Unknown")).toBeInTheDocument();
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument();
    expect(await canvas.findAllByText("￥0")).toHaveLength(2);
  }
}`,...r.parameters?.docs?.source}}};const et=["Default"];export{r as Default,et as __namedExportsOrder,tt as default};
