import{j as r}from"./iframe-dHABiMeZ.js";import{f as s}from"./test-dBchXaWu.js";import{F as m,i as p}from"./store-BDQXzfpO.js";import{c}from"./categories-CMvCyqKA.js";import{p as f}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as u,u as i,i as y}from"./signInByMockUser-Bq6j-viy.js";import{i as l}from"./insertCategories-B0Xk4IxW.js";import{i as d}from"./insertPayments-CDX4R2OH.js";import{C as h}from"./CategoryTotals-BLmxM1lF.js";import{M as x}from"./chunk-JZWAC4HX-CBO1G18r.js";import"./preload-helper-PPVm8Dsz.js";import"./toCurrency-B1XOnn-n.js";import"./useCategories-BcMKRyaV.js";import"./useQuery-Dir4VHnT.js";import"./usePayments-BgRaBHz2.js";import"./useDateRange-BNCrmCFV.js";import"./startOfMonth-CUyQgTrU.js";import"./toDate-SX-ecmdR.js";import"./text-CUfpPkrv.js";const{expect:a,within:T}=__STORYBOOK_MODULE_TEST__,z={title:"Features/SummaryByMonth/CategoryTotals",component:h,tags:["autodocs"],beforeEach:async()=>{const{firestore:e,auth:t}=p(s);await u(t,i);const o=t.currentUser?.uid??i.id;await y(e,{...i,id:o}),await l(t,e,c),await d(t,e,f)},decorators:e=>r.jsx(x,{initialEntries:["/payments?year=2025&month=04"],children:r.jsx(m,{config:s,children:r.jsx(e,{})})})},n={args:{chunkSize:2},play:async({canvasElement:e})=>{const t=T(e);a(await t.findByLabelText(/category totals chunk 0/i)).toBeInTheDocument(),a(await t.findByLabelText(/category totals chunk 1/i)).toBeInTheDocument();for(const o of c)a(await t.findByText(o.name)).toBeInTheDocument();a(await t.findByText("￥4,000")).toBeInTheDocument(),a(await t.findAllByText("￥0")).toHaveLength(3)}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    chunkSize: 2
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);

    // 指定したチャンク数分の DataList が表示されていること
    expect(await canvas.findByLabelText(/category totals chunk 0/i)).toBeInTheDocument();
    expect(await canvas.findByLabelText(/category totals chunk 1/i)).toBeInTheDocument();

    // カテゴリごとの合計金額が表示されていること
    for (const category of categories) {
      expect(await canvas.findByText(category.name)).toBeInTheDocument();
    }
    expect(await canvas.findByText("￥4,000")).toBeInTheDocument();
    expect(await canvas.findAllByText("￥0")).toHaveLength(3);
  }
}`,...n.parameters?.docs?.source}}};const A=["Default"];export{n as Default,A as __namedExportsOrder,z as default};
