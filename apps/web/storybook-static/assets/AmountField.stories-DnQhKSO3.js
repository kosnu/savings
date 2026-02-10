import{A as c}from"./AmountField-BQz_TAC0.js";import"./iframe-dHABiMeZ.js";import"./preload-helper-PPVm8Dsz.js";import"./BaseField-Cz1ooiGU.js";import"./text-CUfpPkrv.js";import"./text-field-BYxnW1de.js";const{expect:r,within:o}=__STORYBOOK_MODULE_TEST__,x={title:"Features/CreatePayment/AmountField",component:c,args:{}},e={play:async({canvasElement:a,userEvent:n})=>{const s=o(a).getByRole("textbox",{name:/amount/i});await n.type(s,"1000"),r(s).toHaveValue("1000")}},t={args:{error:!0,messages:["This field is required"]},play:async({canvasElement:a})=>{const n=o(a);r(n.getByText("This field is required")).toBeInTheDocument()}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    userEvent
  }) => {
    const canvas = within(canvasElement);
    const textfield = canvas.getByRole("textbox", {
      name: /amount/i
    });
    await userEvent.type(textfield, "1000");
    expect(textfield).toHaveValue("1000");
  }
}`,...e.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    error: true,
    messages: ["This field is required"]
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("This field is required")).toBeInTheDocument();
  }
}`,...t.parameters?.docs?.source}}};const y=["Default","HasError"];export{e as Default,t as HasError,y as __namedExportsOrder,x as default};
