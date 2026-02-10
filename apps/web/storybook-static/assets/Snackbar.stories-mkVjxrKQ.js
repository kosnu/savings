import{g as i,r as c,j as n}from"./iframe-dHABiMeZ.js";import{o as p}from"./button-Dvhl8X7z.js";import"./preload-helper-PPVm8Dsz.js";const{expect:u,fn:d,userEvent:b,within:m}=__STORYBOOK_MODULE_TEST__,h={title:"Common/Feadbacks/Snackbar",component:i,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{open:!0,onClose:d()},render:({onClose:e,...r})=>{const[a,s]=c.useState(!1),o=c.useCallback(()=>{s(!0)},[]),l=c.useCallback(()=>{s(!1),e()},[e]);return n.jsxs(n.Fragment,{children:[n.jsx(p,{onClick:o,children:"Open snackbar"}),n.jsx(i,{...r,open:a,onClose:l})]})}},t={args:{message:"This is a message",type:"info"},play:async({canvasElement:e})=>{const a=m(e).getByRole("button",{name:"Open snackbar"});await b.click(a);const o=await m(e.ownerDocument.body).findByText("This is a message");u(o).toBeInTheDocument()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    message: "This is a message",
    type: "info"
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", {
      name: "Open snackbar"
    });
    await userEvent.click(button);
    const body = within(canvasElement.ownerDocument.body);
    const text = await body.findByText("This is a message");
    expect(text).toBeInTheDocument();
  }
}`,...t.parameters?.docs?.source}}};const f=["Default"];export{t as Default,f as __namedExportsOrder,h as default};
