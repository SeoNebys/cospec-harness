import { afterEach,describe,expect,it,vi } from 'vitest';
import { screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route,Routes } from 'react-router';
import { BookmarkForm } from '../../../src/client/features/bookmarks/BookmarkForm.js';
import { BookmarkCard } from '../../../src/client/features/bookmarks/BookmarkCard.js';
import { renderClient } from '../../fixtures/render-client.js';

describe('bookmark creation UI',()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it('retrieves details while protecting user-edited fields',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL)=>String(request).includes('/api/tags')
      ? new Response(JSON.stringify({items:[]}),{status:200})
      : new Response(JSON.stringify({kind:'metadata',status:'partial',draftId:'00000000-0000-4000-8000-000000000001',finalUrl:'https://example.com/',title:'Fetched title',description:'Fetched description',iconUrl:null,previewImageUrl:null,warnings:['missing_icon']}),{status:200})));
    const user=userEvent.setup();renderClient(<BookmarkForm onSubmit={vi.fn(async()=>{})}/>);
    await user.type(screen.getByLabelText('Web address'),'https://example.com');await user.type(screen.getByLabelText('Title'),'My title');
    expect(await screen.findByText(/Some page details were unavailable/iu,{}, {timeout:2000})).toBeVisible();expect(screen.getByLabelText('Title')).toHaveValue('My title');
    await waitFor(()=>expect(screen.getByLabelText('Description')).toHaveValue('Fetched description'));
  });
  it('navigates directly to an existing bookmark',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(request:RequestInfo|URL)=>String(request).includes('/api/tags')?new Response(JSON.stringify({items:[]}),{status:200}):new Response(JSON.stringify({kind:'existing',bookmark:{id:'00000000-0000-4000-8000-000000000001',title:'Existing',archived:true}}),{status:200})));
    const user=userEvent.setup();renderClient(<Routes><Route path="/new" element={<BookmarkForm onSubmit={vi.fn(async()=>{})}/>}/><Route path="/bookmarks/:id" element={<h1>Existing bookmark</h1>}/></Routes>,{route:'/new'});
    await user.type(screen.getByLabelText('Web address'),'https://example.com');expect(await screen.findByRole('heading',{name:'Existing bookmark'},{timeout:2000})).toBeVisible();
  });
  it('shows a neutral visual fallback and isolated detail navigation',()=>{
    renderClient(<BookmarkCard bookmark={{id:'00000000-0000-4000-8000-000000000001',url:'https://example.com',title:'Example',description:null,iconAssetUrl:null,previewAssetUrl:null,tags:[],favorite:false,toRead:false,archivedAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}}/>);
    expect(screen.getByRole('link',{name:'View Example'})).toBeVisible();expect(screen.getByText('E')).toBeVisible();
  });
});
