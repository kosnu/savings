import{N as i}from"./NoteField-Iyhne2Qs.js";import"./iframe-dHABiMeZ.js";import"./preload-helper-PPVm8Dsz.js";import"./BaseField-Cz1ooiGU.js";import"./text-CUfpPkrv.js";import"./text-field-BYxnW1de.js";const{expect:r,within:o}=__STORYBOOK_MODULE_TEST__,x={title:"Features/CreatePayment/NoteField",component:i,args:{}},e={play:async({canvasElement:a,userEvent:s})=>{const n=o(a).getByRole("textbox",{name:/note/i});await s.type(n,"This is a note"),r(n).toHaveValue("This is a note")}},t={args:{error:!0,messages:["This field is required"]},play:async({canvasElement:a})=>{const s=o(a);r(s.getByText("This field is required")).toBeInTheDocument()}};e.parameters={...e.parameters,docs:{...e.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    userEvent
  }) => {
    const canvas = within(canvasElement);
    const textfield = canvas.getByRole("textbox", {
      name: /note/i
    });
    await userEvent.type(textfield, "This is a note");
    expect(textfield).toHaveValue("This is a note");
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
