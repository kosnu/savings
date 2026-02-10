import{r as m,j as n,p,d as x,f as T}from"./iframe-dHABiMeZ.js";import{i as w}from"./icons-CFYjOSRb.js";import{o as v}from"./button-Dvhl8X7z.js";import{o as k}from"./reset-ELlVgqbp.js";import{p as C}from"./text-CUfpPkrv.js";import{L as B,M as O}from"./chunk-JZWAC4HX-CBO1G18r.js";import"./preload-helper-PPVm8Dsz.js";import"./require-react-element-xuZeOgzx.js";const _="_tree-children-wrapper_lvgc1_1",E="_tree-button_lvgc1_5",f={treeChildrenWrapper:_,treeButton:E};function L(){const[e,t]=m.useState(!1),a=m.useCallback(()=>{t(r=>!r)},[]);return{toggle:e,switchToggle:a}}function u({treeObject:e,onLinkClick:t}){const{toggle:a,switchToggle:r}=L();if(!!!e.children?.length){const s=S(b,e.href??"#");return n.jsx(s,{ariaLabel:e.label,onClick:t,children:n.jsx(h,{startIcon:e.icon,children:e.label})})}return n.jsxs(p,{direction:"column",justify:"start",gap:"3",flexGrow:"1",children:[n.jsx(b,{ariaLabel:e.label,onClick:r,children:n.jsx(h,{startIcon:e.icon,endIcon:a?n.jsx(w,{}):n.jsx(x,{}),children:e.label})}),a&&n.jsx(p,{className:f.treeChildrenWrapper,direction:"column",justify:"start",gap:"3",pl:"4",children:e.children?.map(s=>n.jsx(u,{treeObject:s,onLinkClick:t},s.id))})]})}function h({startIcon:e,endIcon:t,children:a}){return n.jsxs(p,{direction:"row",justify:"between",align:"center",gap:"3",flexGrow:"1",children:[e,n.jsx(C,{align:"left",style:{flex:"auto"},children:a}),t]})}function b({ariaLabel:e,children:t,onClick:a}){return n.jsx(v,{"aria-label":e,className:f.treeButton,variant:"ghost",size:"3",onClick:a,children:t})}function S(e,t){return function({children:r,onClick:c,...s}){return n.jsx(k,{children:n.jsx(B,{to:t,onClick:c,children:n.jsx(e,{...s,children:r})})})}}u.__docgenInfo={description:"",methods:[],displayName:"SidebarTreeButton",props:{treeObject:{required:!0,tsType:{name:"TreeObject"},description:""},onLinkClick:{required:!1,tsType:{name:"signature",type:"function",raw:"() => void",signature:{arguments:[],return:{name:"void"}}},description:""}}};const{expect:R,fn:g,userEvent:y,within:j}=__STORYBOOK_MODULE_TEST__,o={id:"title",icon:n.jsx(T,{}),label:"Payments",children:[{id:"2025",label:"2025年",children:[{id:"01",label:"1月",href:"/payments?year=2025&month=01"},{id:"02",label:"2月",href:"/payments?year=2025&month=02"}]},{id:"2024",label:"2024年",children:[{id:"01",label:"1月",href:"/payments?year=2024&month=01"}]},{id:"2023",label:"2023年",children:[]}]},H={title:"Common/Buttons/SidebarTreeButton",component:u,parameters:{layout:"centered"},tags:["autodocs"],argTypes:{},args:{onLinkClick:g()},decorators:[e=>n.jsx(O,{initialEntries:["/"],children:n.jsx("div",{style:{width:"300px"},children:n.jsx(e,{})})})]},l={args:{treeObject:o}},i={args:{treeObject:o},play:async({canvasElement:e})=>{const a=await j(e).findByRole("button",{name:o.label});await y.click(a)}},d={args:{treeObject:o,onLinkClick:g()},play:async e=>{await i.play?.(e);const t=j(e.canvasElement),a=await t.findByRole("button",{name:o.children[0].label});await y.click(a);for(const r of o.children[0].children){const c=await t.findByRole("button",{name:r.label});await e.userEvent.click(c)}R(e.args.onLinkClick).toHaveBeenCalledTimes(2)}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    treeObject: sampleTreeObject
  }
}`,...l.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    treeObject: sampleTreeObject
  },
  play: async ({
    canvasElement
  }) => {
    const canvas = within(canvasElement);
    const button = await canvas.findByRole("button", {
      name: sampleTreeObject.label
    });
    await userEvent.click(button);
  }
}`,...i.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    treeObject: sampleTreeObject,
    onLinkClick: fn()
  },
  play: async ctx => {
    await OpenFirstTree.play?.(ctx);
    const canvas = within(ctx.canvasElement);
    const button = await canvas.findByRole("button", {
      name: sampleTreeObject.children[0].label
    });
    await userEvent.click(button);
    for (const child of sampleTreeObject.children[0].children) {
      const button = await canvas.findByRole("button", {
        name: child.label
      });
      await ctx.userEvent.click(button);
    }
    expect(ctx.args.onLinkClick).toHaveBeenCalledTimes(2);
  }
}`,...d.parameters?.docs?.source}}};const $=["Default","OpenFirstTree","OpenSecondTree"];export{l as Default,i as OpenFirstTree,d as OpenSecondTree,$ as __namedExportsOrder,H as default};
