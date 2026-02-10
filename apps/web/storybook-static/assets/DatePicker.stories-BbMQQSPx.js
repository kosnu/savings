import{D as m}from"./DatePicker-Duu0yJ5K.js";import"./iframe-dHABiMeZ.js";import"./preload-helper-PPVm8Dsz.js";import"./formatDateToLocaleString-Bdtd92uY.js";import"./toDate-SX-ecmdR.js";import"./startOfMonth-CUyQgTrU.js";import"./require-react-element-xuZeOgzx.js";import"./index-DiWxZG_m.js";import"./index-CUv62izO.js";import"./button-Dvhl8X7z.js";const{userEvent:o,within:s}=__STORYBOOK_MODULE_TEST__,B={title:"Common/Inputs/DatePicker",component:m,parameters:{layout:"centered",mockingDate:new Date(2025,4,1)},tags:["autodocs"],argTypes:{},args:{}},t={args:{}},a={tags:["skip"],args:{defaultValue:new Date(2025,4,10)},play:async({canvasElement:n})=>{const e=s(n),r=await e.findByRole("button",{name:/date/i});await o.click(r);const c=n.ownerDocument.body,i=await s(c).findByRole("button",{name:/today/i});await o.click(i),await e.findByText("2025/05/01")}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {}
}`,...t.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  tags: ["skip"],
  args: {
    defaultValue: new Date(2025, 4, 10)
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", {
      name: /date/i
    });
    await userEvent.click(button);
    const body = canvasElement.ownerDocument.body;
    const todayButton = await within(body).findByRole("button", {
      name: /today/i
    });
    await userEvent.click(todayButton);
    await canvas.findByText("2025/05/01");
  }
}`,...a.parameters?.docs?.source}}};const k=["Default","SelectToday"];export{t as Default,a as SelectToday,k as __namedExportsOrder,B as default};
