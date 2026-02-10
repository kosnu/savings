import{j as e}from"./iframe-dHABiMeZ.js";import{A as m,a as c,b as r,c as d}from"./Accordion-D4a1Yify.js";import{o as y}from"./card-Bj6pjYUl.js";import"./preload-helper-PPVm8Dsz.js";import"./index-CUv62izO.js";import"./reset-ELlVgqbp.js";import"./require-react-element-xuZeOgzx.js";const{expect:n,waitFor:h,within:I}=__STORYBOOK_MODULE_TEST__,T={title:"Common/Misc/Accordion",component:m,tags:["autodocs"],decorators:[o=>e.jsx(y,{style:{maxWidth:320},children:e.jsx(o,{})})]},i={args:{type:"single",collapsible:!0,children:e.jsxs(e.Fragment,{children:[e.jsxs(c,{value:"item-1",children:[e.jsx(r,{children:"Is it accessible?"}),e.jsx(d,{children:"Yes. It adheres to the WAI-ARIA design pattern."})]}),e.jsxs(c,{value:"item-2",children:[e.jsx(r,{children:"Is it unstyled?"}),e.jsx(d,{children:"Yes. It's unstyled by default, giving you freedom over the look and feel."})]})]})},play:async({canvasElement:o,userEvent:s})=>{const t=I(o),l=t.getByRole("button",{name:/Is it accessible?/i});await s.click(l),n(await t.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).toBeInTheDocument(),n(t.queryByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).not.toBeInTheDocument();const u=t.getByRole("button",{name:/Is it unstyled?/i});await s.click(u),await h(()=>n(t.queryByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).not.toBeInTheDocument()),n(await t.findByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).toBeInTheDocument()}},a={args:{type:"multiple",children:e.jsxs(e.Fragment,{children:[e.jsxs(c,{value:"item-1",children:[e.jsx(r,{children:"Is it accessible?"}),e.jsx(d,{children:"Yes. It adheres to the WAI-ARIA design pattern."})]}),e.jsxs(c,{value:"item-2",children:[e.jsx(r,{children:"Is it unstyled?"}),e.jsx(d,{children:"Yes. It's unstyled by default, giving you freedom over the look and feel."})]})]})},play:async({canvasElement:o,userEvent:s})=>{const t=I(o),l=t.getByRole("button",{name:/Is it accessible?/i});await s.click(l),n(await t.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).toBeInTheDocument(),n(t.queryByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).not.toBeInTheDocument();const u=t.getByRole("button",{name:/Is it unstyled?/i});await s.click(u),n(await t.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).toBeInTheDocument(),n(await t.findByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).toBeInTheDocument()}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  args: {
    type: "single",
    collapsible: true,
    children: <>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it unstyled?</AccordionTrigger>
          <AccordionContent>
            Yes. It's unstyled by default, giving you freedom over the look and
            feel.
          </AccordionContent>
        </AccordionItem>
      </>
  },
  play: async ({
    canvasElement,
    userEvent
  }) => {
    const canvas = within(canvasElement);
    const firstButton = canvas.getByRole("button", {
      name: /Is it accessible?/i
    });
    await userEvent.click(firstButton);
    expect(await canvas.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).toBeInTheDocument();
    expect(canvas.queryByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).not.toBeInTheDocument();
    const secondButton = canvas.getByRole("button", {
      name: /Is it unstyled?/i
    });
    await userEvent.click(secondButton);

    // Wait for the first content to be removed from the DOM
    await waitFor(() => expect(canvas.queryByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).not.toBeInTheDocument());
    expect(await canvas.findByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).toBeInTheDocument();
  }
}`,...i.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    type: "multiple",
    children: <>
        <AccordionItem value="item-1">
          <AccordionTrigger>Is it accessible?</AccordionTrigger>
          <AccordionContent>
            Yes. It adheres to the WAI-ARIA design pattern.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>Is it unstyled?</AccordionTrigger>
          <AccordionContent>
            Yes. It's unstyled by default, giving you freedom over the look and
            feel.
          </AccordionContent>
        </AccordionItem>
      </>
  },
  play: async ({
    canvasElement,
    userEvent
  }) => {
    const canvas = within(canvasElement);
    const firstButton = canvas.getByRole("button", {
      name: /Is it accessible?/i
    });
    await userEvent.click(firstButton);
    expect(await canvas.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).toBeInTheDocument();
    expect(canvas.queryByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).not.toBeInTheDocument();
    const secondButton = canvas.getByRole("button", {
      name: /Is it unstyled?/i
    });
    await userEvent.click(secondButton);
    expect(await canvas.findByText(/Yes. It adheres to the WAI-ARIA design pattern./i)).toBeInTheDocument();
    expect(await canvas.findByText(/Yes. It's unstyled by default, giving you freedom over the look and feel./i)).toBeInTheDocument();
  }
}`,...a.parameters?.docs?.source}}};const b=["Default","Multiple"];export{i as Default,a as Multiple,b as __namedExportsOrder,T as default};
