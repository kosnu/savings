import{h as E,j as l,T as I,Q as C}from"./iframe-dHABiMeZ.js";import{g as i}from"./react.esm-DslVtTgX.js";import{f as v}from"./test-dBchXaWu.js";import{F as S,i as D}from"./store-BDQXzfpO.js";import{c as F}from"./categories-CMvCyqKA.js";import{p as L}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as O,u as k,i as _}from"./signInByMockUser-Bq6j-viy.js";import{i as q}from"./insertCategories-B0Xk4IxW.js";import{i as P}from"./insertPayments-CDX4R2OH.js";import{C as j}from"./CreatePaymentModal-BPXwa9hN.js";import"./preload-helper-PPVm8Dsz.js";import"./client-CTlwWJaA.js";import"./useDialog-CF0JRvEy.js";import"./CreatePaymentForm-Iu8FkQVN.js";import"./CancelButton-DZNQ4KDk.js";import"./button-Dvhl8X7z.js";import"./SubmitButton-dmfL9Mam.js";import"./AmountField-BQz_TAC0.js";import"./BaseField-Cz1ooiGU.js";import"./text-CUfpPkrv.js";import"./text-field-BYxnW1de.js";import"./CategoryField-CPeCq57x.js";import"./react-error-boundary-C3Blex15.js";import"./useCategories-BcMKRyaV.js";import"./useQuery-Dir4VHnT.js";import"./icons-CFYjOSRb.js";import"./index-CpcVBN9V.js";import"./index-DiWxZG_m.js";import"./index-CUv62izO.js";import"./NoteField-Iyhne2Qs.js";import"./PaymentDateField-3b5FjYA4.js";import"./DatePicker-Duu0yJ5K.js";import"./formatDateToLocaleString-Bdtd92uY.js";import"./toDate-SX-ecmdR.js";import"./startOfMonth-CUyQgTrU.js";import"./require-react-element-xuZeOgzx.js";import"./dialog-B3tDX_ew.js";const{expect:o,fn:A,userEvent:n,waitFor:r}=__STORYBOOK_MODULE_TEST__,kt={title:"Features/CreatePayment/CreatePaymentModal",component:j,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{onSuccess:A()},beforeEach:async()=>{const{firestore:e,auth:a}=D(v);await O(a,k);const c=a.currentUser?.uid??k.id;await _(e,{...k,id:c}),await q(a,e,F),await P(a,e,L)},decorators:e=>{const a=E();return l.jsx(I,{children:l.jsx(C,{client:a,children:l.jsx(S,{config:v,children:l.jsx(e,{})})})})}},u={},y={play:async({canvasElement:e})=>{const c=i(e).getByRole("button",{name:/create payment/i});await n.click(c);const t=i(e.ownerDocument.body);o(await t.findByRole("dialog")).toBeInTheDocument()}},p={play:async({canvasElement:e,args:a})=>{const c=i(e),t=i(e.ownerDocument.body),b=c.getByRole("button",{name:/create payment/i});await n.click(b);const g=await t.findByRole("dialog");o(g).toBeInTheDocument();const m=t.getByRole("checkbox",{name:/continue creating/i});await n.click(m),o(m).toBeChecked();const B=t.getByRole("combobox",{name:/category/i});await n.click(B);const s=await t.findByRole("listbox");await r(()=>{o(i(s).queryByLabelText(/loading/)).not.toBeInTheDocument()});const w=await i(s).findByRole("option",{name:/food/i});await n.click(w);const x=t.getByLabelText(/amount/i);await n.type(x,"1000");const h=t.getByLabelText(/note/i);await n.type(h,"Test payment");const f=t.getByRole("button",{name:/^create$/i});await n.click(f),await r(()=>{o(t.queryByRole("dialog")).toBeInTheDocument()},{timeout:3e3}),await r(()=>{const T=t.getByLabelText(/amount/i);o(T).toHaveValue("")},{timeout:1e3});const R=t.getByRole("checkbox",{name:/continue creating/i});o(R).toBeChecked(),o(a.onSuccess).toHaveBeenCalled()}},d={play:async({canvasElement:e,args:a})=>{const c=i(e),t=i(e.ownerDocument.body),b=c.getByRole("button",{name:/create payment/i});await n.click(b);const g=await t.findByRole("dialog");o(g).toBeInTheDocument();const m=t.getByRole("checkbox",{name:/continue creating/i});o(m).not.toBeChecked();const B=t.getByRole("combobox",{name:/category/i});await n.click(B);const s=await t.findByRole("listbox");await r(()=>{o(i(s).queryByLabelText(/loading/)).not.toBeInTheDocument()});const w=await i(s).findByRole("option",{name:/food/i});await n.click(w);const x=t.getByLabelText(/amount/i);await n.type(x,"2000");const h=t.getByLabelText(/note/i);await n.type(h,"Test payment without continuous mode");const f=t.getByRole("button",{name:/^create$/i});await n.click(f),await r(()=>{o(a.onSuccess).toHaveBeenCalled()},{timeout:3e3})}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:"{}",...u.parameters?.docs?.source}}};y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const openButton = canvas.getByRole("button", {
      name: /create payment/i
    });
    await userEvent.click(openButton);
    const body = within(canvasElement.ownerDocument.body);
    expect(await body.findByRole("dialog")).toBeInTheDocument();
  }
}`,...y.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    // Open the dialog
    const openButton = canvas.getByRole("button", {
      name: /create payment/i
    });
    await userEvent.click(openButton);

    // Wait for dialog to appear
    const dialog = await body.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Enable continuous creation mode
    const checkbox = body.getByRole("checkbox", {
      name: /continue creating/i
    });
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Fill the form - select category
    const categorySelect = body.getByRole("combobox", {
      name: /category/i
    });
    await userEvent.click(categorySelect);
    const listbox = await body.findByRole("listbox");
    await waitFor(() => {
      expect(within(listbox).queryByLabelText(/loading/)).not.toBeInTheDocument();
    });
    const categoryOption = await within(listbox).findByRole("option", {
      name: /food/i
    });
    await userEvent.click(categoryOption);

    // Fill other fields
    const amountInput = body.getByLabelText(/amount/i);
    await userEvent.type(amountInput, "1000");
    const noteInput = body.getByLabelText(/note/i);
    await userEvent.type(noteInput, "Test payment");

    // Submit the form
    const submitButton = body.getByRole("button", {
      name: /^create$/i
    });
    await userEvent.click(submitButton);

    // Wait for submission to complete and verify dialog remains open
    await waitFor(() => {
      expect(body.queryByRole("dialog")).toBeInTheDocument();
    }, {
      timeout: 3000
    });

    // Verify form was reset (amount should be empty)
    await waitFor(() => {
      const amountInputAfterSubmit = body.getByLabelText(/amount/i);
      expect(amountInputAfterSubmit).toHaveValue("");
    }, {
      timeout: 1000
    });

    // Verify checkbox remains checked after form reset
    const checkboxAfterSubmit = body.getByRole("checkbox", {
      name: /continue creating/i
    });
    expect(checkboxAfterSubmit).toBeChecked();

    // Verify onSuccess was called (dialog should stay open)
    expect(args.onSuccess).toHaveBeenCalled();
  }
}`,...p.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  play: async ({
    canvasElement,
    args
  }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    // Open the dialog
    const openButton = canvas.getByRole("button", {
      name: /create payment/i
    });
    await userEvent.click(openButton);

    // Wait for dialog to appear
    const dialog = await body.findByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // Verify checkbox is not checked by default
    const checkbox = body.getByRole("checkbox", {
      name: /continue creating/i
    });
    expect(checkbox).not.toBeChecked();

    // Fill the form - select category
    const categorySelect = body.getByRole("combobox", {
      name: /category/i
    });
    await userEvent.click(categorySelect);
    const listbox = await body.findByRole("listbox");
    await waitFor(() => {
      expect(within(listbox).queryByLabelText(/loading/)).not.toBeInTheDocument();
    });
    const categoryOption = await within(listbox).findByRole("option", {
      name: /food/i
    });
    await userEvent.click(categoryOption);

    // Fill other fields
    const amountInput = body.getByLabelText(/amount/i);
    await userEvent.type(amountInput, "2000");
    const noteInput = body.getByLabelText(/note/i);
    await userEvent.type(noteInput, "Test payment without continuous mode");

    // Submit the form
    const submitButton = body.getByRole("button", {
      name: /^create$/i
    });
    await userEvent.click(submitButton);

    // Wait for submission to complete and verify onSuccess was called
    await waitFor(() => {
      expect(args.onSuccess).toHaveBeenCalled();
    }, {
      timeout: 3000
    });
  }
}`,...d.parameters?.docs?.source}}};const vt=["Default","OpenModal","ContinuousCreationEnabled","ContinuousCreationDisabled"];export{d as ContinuousCreationDisabled,p as ContinuousCreationEnabled,u as Default,y as OpenModal,vt as __namedExportsOrder,kt as default};
