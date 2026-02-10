import{r as y,j as n,p as x}from"./iframe-dHABiMeZ.js";import{f as g}from"./test-dBchXaWu.js";import{F as v,i as D}from"./store-BDQXzfpO.js";import{p as R}from"./useAuthCurrentUser-BTHXZyFx.js";import{s as I,i as S,u as f}from"./signInByMockUser-Bq6j-viy.js";import{i as E}from"./insertPayments-CDX4R2OH.js";import{C as P}from"./CreatePaymentModal-BPXwa9hN.js";import{P as k}from"./PaymentList-CPtgedPg.js";import{S as j}from"./Summary-CsOXWBnS.js";import{p as _}from"./container-IyyOPDwT.js";import{M as O}from"./chunk-JZWAC4HX-CBO1G18r.js";import"./preload-helper-PPVm8Dsz.js";import"./useDialog-CF0JRvEy.js";import"./CreatePaymentForm-Iu8FkQVN.js";import"./CancelButton-DZNQ4KDk.js";import"./button-Dvhl8X7z.js";import"./SubmitButton-dmfL9Mam.js";import"./AmountField-BQz_TAC0.js";import"./BaseField-Cz1ooiGU.js";import"./text-CUfpPkrv.js";import"./text-field-BYxnW1de.js";import"./CategoryField-CPeCq57x.js";import"./react-error-boundary-C3Blex15.js";import"./useCategories-BcMKRyaV.js";import"./useQuery-Dir4VHnT.js";import"./icons-CFYjOSRb.js";import"./index-CpcVBN9V.js";import"./index-DiWxZG_m.js";import"./index-CUv62izO.js";import"./NoteField-Iyhne2Qs.js";import"./PaymentDateField-3b5FjYA4.js";import"./DatePicker-Duu0yJ5K.js";import"./formatDateToLocaleString-Bdtd92uY.js";import"./toDate-SX-ecmdR.js";import"./startOfMonth-CUyQgTrU.js";import"./require-react-element-xuZeOgzx.js";import"./dialog-B3tDX_ew.js";import"./PaymentCard-G1MOJIv5.js";import"./card-Bj6pjYUl.js";import"./badge-CxyYVrRk.js";import"./skeleton-CXonK7rb.js";import"./usePayments-BgRaBHz2.js";import"./useDateRange-BNCrmCFV.js";import"./PaymentItem-D18nRyb1.js";import"./ActionMenuButton-TbQHBfx0.js";import"./DeletePaymentModal-ImpBm8y3.js";import"./toCurrency-B1XOnn-n.js";import"./get-subtree-B5itu7Ql.js";import"./Accordion-D4a1Yify.js";import"./reset-ELlVgqbp.js";import"./CategoryTotals-BLmxM1lF.js";import"./MonthlyTotals-Dw_R9IHI.js";function w(){const[e,t]=y.useState(0),s=y.useCallback(()=>{t(i=>i+1)},[]),l=y.useCallback(()=>{t(i=>i+1)},[]);return n.jsx(_,{size:"4",children:n.jsxs(x,{direction:"column",gap:"3",children:[n.jsx(j,{},`summary-${e}`),n.jsx(x,{justify:"end",align:"center",gap:"3",children:n.jsx(P,{onSuccess:s})}),n.jsx(k,{onDeleteSuccess:l},`payment-list-${e}`)]})})}w.__docgenInfo={description:"",methods:[],displayName:"PaymentsPage"};const{expect:o,waitFor:C,within:a}=__STORYBOOK_MODULE_TEST__,Ct={title:"Pages/PaymentsPage",component:w,parameters:{},tags:["autodocs"],beforeEach:async()=>{const{firestore:e,auth:t}=D(g);await I(t,f),await S(e,f),await E(t,e,R)},decorators:[e=>n.jsx(O,{initialEntries:["/payments"],children:n.jsx(v,{config:g,children:n.jsx(e,{})})})],argTypes:{},args:{}},m={args:{},play:async({canvasElement:e})=>{const t=a(e);t.getByRole("button",{name:/create payment/i}),o(await t.findAllByText("コンビニ")).toHaveLength(3),o(await t.findByText("スーパー")).toBeInTheDocument(),o(await t.findByText("2025/06/02")).toBeInTheDocument(),o(await t.findAllByText("￥4,000")).toHaveLength(2)}},p={args:{},tags:["skip"],play:async({canvasElement:e,userEvent:t})=>{const s=a(e),l=s.getByRole("button",{name:/create payment/i});await t.click(l);const i=a(e.ownerDocument.body),r=await i.findByRole("dialog",{name:/create payment/i});o(r).toBeInTheDocument();const B=a(r).getByRole("combobox",{name:/category/i});await t.click(B);const h=await i.findByRole("listbox"),b=await a(h).findByRole("option",{name:/food/i});await t.click(b);const c=`Test_${Date.now().toString()}`,u=a(r).getByRole("textbox",{name:/note/i});await t.type(u,c);const d=a(r).getByRole("textbox",{name:/amount/i});await t.type(d,"1080"),await C(()=>{o(u).toHaveValue(c),o(d).toHaveValue("1080")});const T=a(r).getByRole("button",{name:/^create$/i});await t.click(T),o(await s.findByText(c)).toBeInTheDocument(),o(s.queryByText(c)).not.toBeInTheDocument()}};m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {},
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("button", {
      name: /create payment/i
    });
    expect(await canvas.findAllByText("コンビニ")).toHaveLength(3);
    expect(await canvas.findByText("スーパー")).toBeInTheDocument();
    expect(await canvas.findByText("2025/06/02")).toBeInTheDocument();
    expect(await canvas.findAllByText("￥4,000")).toHaveLength(2);
  }
}`,...m.parameters?.docs?.source}}};p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {},
  tags: ["skip"],
  play: async ({
    canvasElement,
    userEvent
  }) => {
    const canvas = within(canvasElement);
    const createButton = canvas.getByRole("button", {
      name: /create payment/i
    });
    await userEvent.click(createButton);
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", {
      name: /create payment/i
    });
    expect(dialog).toBeInTheDocument();
    const categorySelect = within(dialog).getByRole("combobox", {
      name: /category/i
    });
    await userEvent.click(categorySelect);
    const listbox = await body.findByRole("listbox");
    const foodOption = await within(listbox).findByRole("option", {
      name: /food/i
    });
    await userEvent.click(foodOption);
    const timestamp = Date.now().toString();
    const note = \`Test_\${timestamp}\`;
    const noteInput = within(dialog).getByRole("textbox", {
      name: /note/i
    });
    await userEvent.type(noteInput, note);
    const amountTextfield = within(dialog).getByRole("textbox", {
      name: /amount/i
    });
    await userEvent.type(amountTextfield, "1080");
    await waitFor(() => {
      expect(noteInput).toHaveValue(note);
      expect(amountTextfield).toHaveValue("1080");
    });

    // FIXME: Submitからリストのリフレッシュまでが早すぎて、PaymentListの再描画が間に合わない
    const submitButton = within(dialog).getByRole("button", {
      name: /^create$/i
    });
    await userEvent.click(submitButton);
    expect(await canvas.findByText(note)).toBeInTheDocument();

    // TODO: PaymentItemのアクションから削除を行う処理を実装する

    expect(canvas.queryByText(note)).not.toBeInTheDocument();
  }
}`,...p.parameters?.docs?.source}}};const Ht=["Default","CreateAndDelete"];export{p as CreateAndDelete,m as Default,Ht as __namedExportsOrder,Ct as default};
