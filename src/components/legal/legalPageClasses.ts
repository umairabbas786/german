/** Shared Tailwind classes for Privacy / Terms fullscreen pages. */
export const legalPageContainerClass =
  'fixed inset-0 z-[2000] font-[-apple-system,BlinkMacSystemFont,"Segoe_UI",Roboto,Oxygen,Ubuntu,Cantarell,"Open_Sans","Helvetica_Neue",sans-serif]';

export const legalCardClass =
  '!fixed !top-0 !left-0 !m-0 !box-border !block !h-screen !w-full !max-w-none !rounded-none !border-none !bg-white/95 !p-10 !pt-20 !shadow-none !backdrop-blur-[20px] max-sm:!px-5 max-sm:!pt-[30px] max-sm:!pb-[calc(30px+env(safe-area-inset-bottom,0px))] overflow-y-auto z-[1000]';

export const legalCloseBtnClass =
  'fixed top-5 right-5 z-[1002] flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-black/20 bg-white/90 text-[#333] backdrop-blur-[8px] transition-all duration-200 ease-in-out hover:scale-105 hover:bg-white/95 hover:text-black hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] max-sm:top-[15px] max-sm:right-[15px] max-sm:h-10 max-sm:w-10';

export const legalContentClass = [
  'mx-auto max-w-[800px] pb-[60px] text-left',
  '[&_h1]:mb-[5px] [&_h1]:text-left [&_h1]:text-[1.8rem] [&_h1]:font-bold [&_h1]:text-[#1a1a1a]',
  '[&_section]:mb-[25px]',
  '[&_h2]:mb-2 [&_h2]:text-[1.1rem] [&_h2]:font-semibold [&_h2]:text-[#222]',
  '[&_p]:mb-2 [&_p]:text-[0.95rem] [&_p]:leading-normal [&_p]:text-[#444]',
  '[&_li]:mb-2 [&_li]:text-[0.95rem] [&_li]:leading-normal [&_li]:text-[#444]',
  '[&_ul]:mb-2.5 [&_ul]:list-outside [&_ul]:list-disc [&_ul]:pl-6',
  '[&_a]:text-[#007bff] [&_a]:no-underline hover:[&_a]:underline',
].join(' ');

export const legalLastUpdatedClass = 'mb-[30px] text-left text-[0.85rem] text-[#888]';
