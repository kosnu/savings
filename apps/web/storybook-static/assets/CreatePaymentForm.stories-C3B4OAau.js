import{h as f,j as r,T as w,Q as b}from"./iframe-dHABiMeZ.js";import{g as i}from"./react.esm-DslVtTgX.js";import{f as u}from"./test-dBchXaWu.js";import{F as B,i as g}from"./store-BDQXzfpO.js";import{c as T}from"./categories-CMvCyqKA.js";import{p as v}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as E,u as l,i as h}from"./signInByMockUser-Bq6j-viy.js";import{i as R}from"./insertCategories-B0Xk4IxW.js";import{i as C}from"./insertPayments-CDX4R2OH.js";import{C as D}from"./CreatePaymentForm-Iu8FkQVN.js";import"./preload-helper-PPVm8Dsz.js";import"./client-CTlwWJaA.js";import"./CancelButton-DZNQ4KDk.js";import"./button-Dvhl8X7z.js";import"./SubmitButton-dmfL9Mam.js";import"./AmountField-BQz_TAC0.js";import"./BaseField-Cz1ooiGU.js";import"./text-CUfpPkrv.js";import"./text-field-BYxnW1de.js";import"./CategoryField-CPeCq57x.js";import"./react-error-boundary-C3Blex15.js";import"./useCategories-BcMKRyaV.js";import"./useQuery-Dir4VHnT.js";import"./icons-CFYjOSRb.js";import"./index-CpcVBN9V.js";import"./index-DiWxZG_m.js";import"./index-CUv62izO.js";import"./NoteField-Iyhne2Qs.js";import"./PaymentDateField-3b5FjYA4.js";import"./DatePicker-Duu0yJ5K.js";import"./formatDateToLocaleString-Bdtd92uY.js";import"./toDate-SX-ecmdR.js";import"./startOfMonth-CUyQgTrU.js";import"./require-react-element-xuZeOgzx.js";const{expect:p,fn:d,userEvent:n,waitFor:k}=__STORYBOOK_MODULE_TEST__,pt={title:"Features/CreatePayment/CreatePaymentForm",component:D,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{onSuccess:d(),onCancel:d()},beforeEach:async()=>{const{firestore:e,auth:t}=g(u);await E(t,l);const o=t.currentUser?.uid??l.id;await h(e,{...l,id:o}),await R(t,e,T),await C(t,e,v)},decorators:e=>{const t=f();return r.jsx(w,{children:r.jsx(b,{client:t,children:r.jsx(B,{config:u,children:r.jsx(e,{})})})})}},s={args:{}},c={args:{},play:async({canvasElement:e})=>{const t=i(e),o=t.getByRole("button",{name:/date/i});await n.click(o);{const a=await t.findByRole("combobox",{name:/category/i});await n.click(a);const y=await i(e.ownerDocument.body).findByRole("listbox");await k(()=>{p(i(y).queryByLabelText(/loading/)).not.toBeInTheDocument()});const x=await i(y).findByRole("option",{name:/food/i});await n.click(x)}{const a=t.getByRole("textbox",{name:/note/i});await n.type(a,"Test_FSf5qxLNxAC265uSTcNa")}{const a=t.getByRole("textbox",{name:/amount/i});await n.type(a,"1080")}}},m={args:{},play:async({canvasElement:e})=>{const t=i(e),o=t.getByRole("button",{name:/create$/i});await n.click(o),p(await t.findByText("Category can not be empty")).toBeInTheDocument(),p(await t.findByText("Note can not be empty")).toBeInTheDocument(),p(await t.findByText("Amount can not be empty")).toBeInTheDocument()}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {}
}`,...s.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {},
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const datepicker = canvas.getByRole("button", {
      name: /date/i
    });
    await userEvent.click(datepicker);

    // NOTE: 今日の日付はデフォルトで選択されているので、あえてクリックしない
    // const body = canvasElement.ownerDocument.body
    // {
    //   const todayButton = await within(body).findByRole("button", {
    //     name: /today/i,
    //   })
    //   await userEvent.click(todayButton)
    // }
    {
      const select = await canvas.findByRole("combobox", {
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
    {
      const noteTextfield = canvas.getByRole("textbox", {
        name: /note/i
      });
      await userEvent.type(noteTextfield, "Test_FSf5qxLNxAC265uSTcNa");
    }
    {
      const amountTextfield = canvas.getByRole("textbox", {
        name: /amount/i
      });
      await userEvent.type(amountTextfield, "1080");
    }
  }
}`,...c.parameters?.docs?.source}}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {},
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const submitButton = canvas.getByRole("button", {
      name: /create$/i
    });
    await userEvent.click(submitButton);
    expect(await canvas.findByText("Category can not be empty")).toBeInTheDocument();
    expect(await canvas.findByText("Note can not be empty")).toBeInTheDocument();
    expect(await canvas.findByText("Amount can not be empty")).toBeInTheDocument();
  }
}`,...m.parameters?.docs?.source}}};const lt=["Default","Fiiled","Empty"];export{s as Default,m as Empty,c as Fiiled,lt as __namedExportsOrder,pt as default};
