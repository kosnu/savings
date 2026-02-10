import{j as a}from"./iframe-dHABiMeZ.js";import{g as o}from"./react.esm-DslVtTgX.js";import{f as p}from"./test-dBchXaWu.js";import{F as i}from"./store-BDQXzfpO.js";import{p as m}from"./useAuthCurrentUser-BTHXZyFx.js";import{A as u}from"./ActionMenuButton-TbQHBfx0.js";import"./preload-helper-PPVm8Dsz.js";import"./client-CTlwWJaA.js";import"./useDialog-CF0JRvEy.js";import"./DeletePaymentModal-ImpBm8y3.js";import"./CancelButton-DZNQ4KDk.js";import"./button-Dvhl8X7z.js";import"./formatDateToLocaleString-Bdtd92uY.js";import"./toDate-SX-ecmdR.js";import"./toCurrency-B1XOnn-n.js";import"./dialog-B3tDX_ew.js";import"./text-CUfpPkrv.js";import"./require-react-element-xuZeOgzx.js";import"./index-CUv62izO.js";import"./index-DiWxZG_m.js";import"./get-subtree-B5itu7Ql.js";import"./index-CpcVBN9V.js";import"./icons-CFYjOSRb.js";const{expect:s,fn:l,userEvent:y}=__STORYBOOK_MODULE_TEST__,K={title:"Common/Payments/ActionMenuButton",component:u,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{onDeleteSuccess:l()},decorators:[e=>a.jsx(i,{config:p,children:a.jsx(e,{})})]},t={args:{payment:m[0]}},n={args:{payment:m[0]},play:async({canvasElement:e})=>{const c=o(e).getByRole("button");y.click(c);const r=await o(e.ownerDocument.body).findByRole("menu");s(r).toBeInTheDocument(),s(o(r).getByText("Delete")).toBeInTheDocument()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    payment: payments[0]
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    payment: payments[0]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    userEvent.click(button);
    const menu = await within(canvasElement.ownerDocument.body).findByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByText("Delete")).toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source}}};const L=["Default","OpenMenu"];export{t as Default,n as OpenMenu,L as __namedExportsOrder,K as default};
