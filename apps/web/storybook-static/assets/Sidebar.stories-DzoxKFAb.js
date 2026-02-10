import{c as g,r as p,v as h,y as x,a as f,j as e,p as d,b as _,C as v}from"./iframe-dHABiMeZ.js";import{p as B}from"./paths-BaoOW6pi.js";import{o as S}from"./button-Dvhl8X7z.js";import{p as T}from"./text-CUfpPkrv.js";import{L as C,M as j}from"./chunk-JZWAC4HX-CBO1G18r.js";import"./preload-helper-PPVm8Dsz.js";const N=["horizontal","vertical"],w=["1","2","3","4"],D={orientation:{type:"enum",className:"rt-r-orientation",values:N,default:"horizontal",responsive:!0},size:{type:"enum",className:"rt-r-size",values:w,default:"1",responsive:!0},color:{...g.color,default:"gray"},decorative:{type:"boolean",default:!0}},l=p.forwardRef((a,t)=>{const{className:c,color:b,decorative:u,...y}=h(a,D,f);return p.createElement("span",{"data-accent-color":b,role:u?void 0:"separator",...y,ref:t,className:x("rt-Separator",c)})});l.displayName="Separator";const E="_sidebar_1eblp_2",I="_sidebar-header_1eblp_41",R="_sidebar-contents_1eblp_46",z="_sidebar-footer_1eblp_52",H="_link_1eblp_57",M="_sidebar-button_1eblp_63",n={sidebar:E,sidebarHeader:I,sidebarContents:R,sidebarFooter:z,link:H,sidebarButton:M};function m({children:a,open:t,onClose:c}){return e.jsxs("aside",{"data-open":t,className:n.sidebar,children:[e.jsxs(d,{className:n.sidebarHeader,p:"4",justify:"between",align:"center",gap:"4",children:[e.jsx(C,{to:B.root.getHref(),className:n.link,children:e.jsx(S,{className:n.sidebarButton,variant:"ghost",size:"3",children:e.jsx(T,{size:"3",weight:"bold",children:"My Savings"})})}),e.jsx(_,{variant:"ghost",onClick:c,children:e.jsx(v,{})})]}),e.jsx(l,{size:"4"}),e.jsx(d,{className:n.sidebarContents,align:"start",gap:"2",p:"4",children:a}),e.jsx(l,{size:"4"}),e.jsx(d,{className:n.sidebarFooter,p:"4"})]})}m.__docgenInfo={description:"",methods:[],displayName:"Sidebar",props:{children:{required:!1,tsType:{name:"ReactNode"},description:""},open:{required:!0,tsType:{name:"boolean"},description:""},onClose:{required:!0,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""}}};const{expect:r,fn:k,within:s}=__STORYBOOK_MODULE_TEST__,K={title:"Shared/Sidebar/Sidebar",component:m,parameters:{layout:"fullscreen"},tags:["autodocs"],decorators:[a=>e.jsx(j,{children:e.jsx(a,{})})],argTypes:{open:{control:"boolean"}},args:{onClose:k()}},o={args:{open:!0,children:"Sidebar Content"},play:async({canvasElement:a})=>{const t=s(a).getByRole("complementary");r(s(t).getByText("My Savings")).toBeInTheDocument(),r(s(t).getByText("Sidebar Content")).toBeInTheDocument(),r(t).toHaveAttribute("data-open","true")}},i={args:{open:!1,children:"Sidebar Content"},play:async({canvasElement:a})=>{const t=s(a).getByRole("complementary");r(s(t).getByText("My Savings")).toBeInTheDocument(),r(s(t).getByText("Sidebar Content")).toBeInTheDocument(),r(t).toHaveAttribute("data-open","false")}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    open: true,
    children: "Sidebar Content"
  },
  play: async ({
    canvasElement
  }) => {
    const sidebar = within(canvasElement).getByRole("complementary");
    expect(within(sidebar).getByText("My Savings")).toBeInTheDocument();
    expect(within(sidebar).getByText("Sidebar Content")).toBeInTheDocument();
    expect(sidebar).toHaveAttribute("data-open", "true");
  }
}`,...o.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    open: false,
    children: "Sidebar Content"
  },
  play: async ({
    canvasElement
  }) => {
    const sidebar = within(canvasElement).getByRole("complementary");
    expect(within(sidebar).getByText("My Savings")).toBeInTheDocument();
    expect(within(sidebar).getByText("Sidebar Content")).toBeInTheDocument();
    expect(sidebar).toHaveAttribute("data-open", "false");
  }
}`,...i.parameters?.docs?.source}}};const U=["Default","Closed"];export{i as Closed,o as Default,U as __namedExportsOrder,K as default};
