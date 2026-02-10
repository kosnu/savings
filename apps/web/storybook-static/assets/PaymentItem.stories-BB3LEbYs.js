import{j as r}from"./iframe-dHABiMeZ.js";import{g as y}from"./react.esm-DslVtTgX.js";import{F as u,gx as s,i as f}from"./store-BDQXzfpO.js";import{f as g}from"./categories-CMvCyqKA.js";import{p as o}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as l,i as T,u as m}from"./signInByMockUser-Bq6j-viy.js";import{i as d}from"./insertPayments-CDX4R2OH.js";import{p as x}from"./formatDateToLocaleString-Bdtd92uY.js";import{t as B}from"./toCurrency-B1XOnn-n.js";import{P as D}from"./PaymentItem-D18nRyb1.js";import"./preload-helper-PPVm8Dsz.js";import"./client-CTlwWJaA.js";import"./toDate-SX-ecmdR.js";import"./ActionMenuButton-TbQHBfx0.js";import"./useDialog-CF0JRvEy.js";import"./DeletePaymentModal-ImpBm8y3.js";import"./CancelButton-DZNQ4KDk.js";import"./button-Dvhl8X7z.js";import"./dialog-B3tDX_ew.js";import"./text-CUfpPkrv.js";import"./require-react-element-xuZeOgzx.js";import"./index-CUv62izO.js";import"./index-DiWxZG_m.js";import"./get-subtree-B5itu7Ql.js";import"./index-CpcVBN9V.js";import"./icons-CFYjOSRb.js";import"./card-Bj6pjYUl.js";import"./badge-CxyYVrRk.js";const{expect:n,fn:h}=__STORYBOOK_MODULE_TEST__,W={title:"Features/ListPayment/PaymentItem",component:D,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{onDeleteSuccess:h()},beforeEach:async()=>{const{firestore:e,auth:t}=f(s);await l(t,m),await T(e,m),await d(t,e,[o[0]])},decorators:[e=>r.jsx(u,{config:s,children:r.jsx(e,{})})]},a={args:{payment:o[0],category:g},play:async({canvasElement:e})=>{const t=y(e),i=o[0].note,c=x(o[0].date),p=B(o[0].amount);n(t.getByText(i)).toBeInTheDocument(),n(t.getByText(c)).toBeInTheDocument(),n(t.getByText(p)).toBeInTheDocument(),n(t.getByRole("button",{name:"Payment actions"})).toBeInTheDocument()}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    payment: payments[0],
    category: foodCat
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const title = payments[0].note;
    const date = formatDateToLocaleString(payments[0].date);
    const price = toCurrency(payments[0].amount);
    expect(canvas.getByText(title)).toBeInTheDocument();
    expect(canvas.getByText(date)).toBeInTheDocument();
    expect(canvas.getByText(price)).toBeInTheDocument();
    expect(canvas.getByRole("button", {
      name: "Payment actions"
    })).toBeInTheDocument();
  }
}`,...a.parameters?.docs?.source}}};const X=["Default"];export{a as Default,X as __namedExportsOrder,W as default};
