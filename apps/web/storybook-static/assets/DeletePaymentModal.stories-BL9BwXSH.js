import{j as p}from"./iframe-dHABiMeZ.js";import{g as n}from"./react.esm-DslVtTgX.js";import{f as y}from"./test-dBchXaWu.js";import{F as w,i as h}from"./store-BDQXzfpO.js";import{p as u,l as x}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as T,i as v,u as g}from"./signInByMockUser-Bq6j-viy.js";import{i as E}from"./insertPayments-CDX4R2OH.js";import{D as R}from"./DeletePaymentModal-ImpBm8y3.js";import"./preload-helper-PPVm8Dsz.js";import"./client-CTlwWJaA.js";import"./CancelButton-DZNQ4KDk.js";import"./button-Dvhl8X7z.js";import"./formatDateToLocaleString-Bdtd92uY.js";import"./toDate-SX-ecmdR.js";import"./toCurrency-B1XOnn-n.js";import"./dialog-B3tDX_ew.js";import"./text-CUfpPkrv.js";import"./require-react-element-xuZeOgzx.js";import"./index-CUv62izO.js";import"./index-DiWxZG_m.js";const{expect:o,fn:P,userEvent:l}=__STORYBOOK_MODULE_TEST__,J={title:"Features/DeletePayment/DeletePaymentModal",component:R,parameters:{layout:"centered"},tags:["autodocs"],args:{onSuccess:P()},beforeEach:async()=>{const{firestore:e,auth:t}=h(y);await T(t,g),await v(e,g),await E(t,e,u)},decorators:[e=>p.jsx(w,{config:y,children:p.jsx(e,{})})]},s={args:{payment:u[0]}},r={args:{open:!0,payment:x}},c={args:{open:!0,payment:void 0},play:async({canvasElement:e})=>{const t=n(e.ownerDocument.body);o(t.getByText("Payment not found.")).toBeInTheDocument();const m=t.getByRole("button",{name:/delete/i});o(m).toBeDisabled()}},i={args:{payment:u[0]},play:async({canvasElement:e})=>{const m=n(e).getByRole("button",{name:/delete payment/i});await l.click(m);const d=n(e.ownerDocument.body),a=await d.findByRole("dialog");o(a).toBeInTheDocument();const B=n(a).getByRole("heading",{name:/delete this payment\?/i});o(B).toBeInTheDocument();const f=n(a).getByRole("button",{name:/cancel/i});await l.click(f);const b=n(a).getByRole("button",{name:/delete/i});await l.click(b);const D=await d.findByText("Payment deleted successfully.");o(D).toBeInTheDocument()}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    payment: payments[0]
  }
}`,...s.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    open: true,
    payment: longPayment
  }
}`,...r.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    open: true,
    payment: undefined
  },
  play: async ({
    canvasElement
  }) => {
    const body = within(canvasElement.ownerDocument.body);
    expect(body.getByText("Payment not found.")).toBeInTheDocument();
    const disabledDeleteButton = body.getByRole("button", {
      name: /delete/i
    });
    expect(disabledDeleteButton).toBeDisabled();
  }
}`,...c.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    payment: payments[0]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const openButton = canvas.getByRole("button", {
      name: /delete payment/i
    });
    await userEvent.click(openButton);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    const title = within(dialog).getByRole("heading", {
      name: /delete this payment\\?/i
    });
    expect(title).toBeInTheDocument();
    const closeButton = within(dialog).getByRole("button", {
      name: /cancel/i
    });
    await userEvent.click(closeButton);
    const deleteButton = within(dialog).getByRole("button", {
      name: /delete/i
    });
    await userEvent.click(deleteButton);
    const successMessage = await body.findByText("Payment deleted successfully.");
    expect(successMessage).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source}}};const V=["Default","LongInfo","NoPayment","ClickDeleteButton"];export{i as ClickDeleteButton,s as Default,r as LongInfo,c as NoPayment,V as __namedExportsOrder,J as default};
