import{j as i}from"./iframe-dHABiMeZ.js";import{f as m}from"./test-dBchXaWu.js";import{F as d,i as y}from"./store-BDQXzfpO.js";import{c as u}from"./categories-CMvCyqKA.js";import{s as f,u as s,i as g}from"./signInByMockUser-Bq6j-viy.js";import{i as w}from"./insertCategories-B0Xk4IxW.js";import{C as b}from"./CategoryField-CPeCq57x.js";import{M as x}from"./chunk-JZWAC4HX-CBO1G18r.js";import"./preload-helper-PPVm8Dsz.js";import"./react-error-boundary-C3Blex15.js";import"./BaseField-Cz1ooiGU.js";import"./text-CUfpPkrv.js";import"./useCategories-BcMKRyaV.js";import"./useQuery-Dir4VHnT.js";import"./icons-CFYjOSRb.js";import"./index-CpcVBN9V.js";import"./index-DiWxZG_m.js";import"./index-CUv62izO.js";const{expect:h,userEvent:l,waitFor:B,within:e}=__STORYBOOK_MODULE_TEST__,Y={title:"Features/CreatePayment/CategoryField",component:b,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{},beforeEach:async()=>{const{firestore:o,auth:t}=y(m);await f(t,s);const r=t.currentUser?.uid??s.id;await g(o,{...s,id:r}),await w(t,o,u)},decorators:[o=>i.jsx(x,{initialEntries:["/payments?year=2025&month=04"],children:i.jsx(d,{config:m,children:i.jsx(o,{})})})]},a={args:{}},n={args:{},play:async({canvasElement:o})=>{const r=e(o).getByRole("combobox",{name:/category/i});await l.click(r);const c=await e(o.ownerDocument.body).findByRole("listbox");await B(()=>{h(e(c).queryByLabelText(/loading/)).not.toBeInTheDocument()});const p=await e(c).findByRole("option",{name:/food/i});await l.click(p)}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {}
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {},
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("combobox", {
      name: /category/i
    });
    await userEvent.click(select);
    const body = within(canvasElement.ownerDocument.body);
    const listbox = await body.findByRole("listbox");
    await waitFor(() => {
      // "loading" ラベルの要素が存在しないことを確認
      expect(within(listbox).queryByLabelText(/loading/)).not.toBeInTheDocument();
    });
    const option = await within(listbox).findByRole("option", {
      name: /food/i
    });
    await userEvent.click(option);
  }
}`,...n.parameters?.docs?.source}}};const z=["Default","Filled"];export{a as Default,n as Filled,z as __namedExportsOrder,Y as default};
