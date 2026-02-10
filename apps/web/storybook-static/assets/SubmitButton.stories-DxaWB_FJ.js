import{S as c}from"./SubmitButton-dmfL9Mam.js";import"./iframe-dHABiMeZ.js";import"./preload-helper-PPVm8Dsz.js";import"./button-Dvhl8X7z.js";const{expect:a,within:o}=__STORYBOOK_MODULE_TEST__,d={title:"Common/Buttons/SubmitButton",component:c,tags:["autodocs"],parameters:{layout:"centered"}},t={args:{children:"Submit"}},n={args:{children:"Submit",loading:!0},play:async({canvasElement:s})=>{const e=o(s).getByRole("button",{name:/submit/i});a(e).toBeDisabled();const r=o(e).getByLabelText(/loading/i);a(r).toBeInTheDocument()}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    children: "Submit"
  }
}`,...t.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    children: "Submit",
    loading: true
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", {
      name: /submit/i
    });
    expect(button).toBeDisabled();
    const spinner = within(button).getByLabelText(/loading/i);
    expect(spinner).toBeInTheDocument();
  }
}`,...n.parameters?.docs?.source}}};const b=["Default","Loading"];export{t as Default,n as Loading,b as __namedExportsOrder,d as default};
