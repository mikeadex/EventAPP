import Image from "next/image";
import { Compass, Buildings, Ticket, Heart, User, MagnifyingGlass, MapPin } from "@phosphor-icons/react/ssr";
import { Mark } from "./brand";

/** A faithful, scaled replica of the app's 01 Discover screen, for marketing sections. */
export function PhoneDiscover() {
  return (
    <div
      className="relative mx-auto h-[640px] w-[300px] overflow-hidden rounded-[44px] border-[6px] border-[#241618] bg-[#0d0a0b] text-[#f2f0ef] shadow-card"
      aria-hidden="true"
      data-theme="dark"
    >
      <div className="absolute inset-x-0 top-0 h-[300px]">
        <Image src="/images/alpha-course.jpg" alt="" fill sizes="300px" className="object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(13,10,11,.72) 0%, rgba(13,10,11,.18) 34%, rgba(13,10,11,.97) 100%)",
          }}
        />
      </div>
      <div className="relative flex h-full flex-col px-4 pb-4 pt-3">
        <div className="flex justify-between text-[11px]">
          <span>9:41</span>
          <span className="tracking-widest text-[#c9bfc2]">▮▮▮</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full border border-[#f98e80]/30 bg-[#0d0a0b]/60 px-3 py-1.5 text-[11px]">
            <MapPin size={11} weight="fill" className="text-[#f98e80]" /> All locations
          </span>
          <span className="flex items-center gap-2">
            <Mark size={22} />
            <span className="flex size-7 items-center justify-center rounded-full border border-[#f98e80]/40 text-[11px] text-[#f98e80]">
              M
            </span>
          </span>
        </div>
        <div className="mt-[118px] flex flex-col items-start gap-2">
          <span className="rounded-full border border-[#f98e80]/45 px-2 py-0.5 text-[8px] uppercase tracking-[0.2em] text-[#f98e80]">
            Class
          </span>
          <span className="text-[26px] leading-none text-[#f7f5f4]">Alpha Course</span>
          <span className="flex items-center gap-2 text-[11px] text-[#c3b8ba]">
            Grace Community <span className="size-[3px] rounded-full bg-[#f98e80]" /> 16 going
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-[#f98e80]/15 bg-[#1b1517] px-3.5 py-2.5 text-[12px] text-[#7e7376]">
          <MagnifyingGlass size={13} /> Search for events
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-[15px]">Happening soon</span>
          <span className="text-[11px] text-[#f98e80]">See all</span>
        </div>
        <div className="relative mt-2.5 h-[132px] overflow-hidden rounded-2xl bg-[#1b1517]">
          <Image src="/images/city-outreach.jpg" alt="" fill sizes="270px" className="object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(13,10,11,.4) 0%, transparent 40%, rgba(13,10,11,.92) 100%)" }}
          />
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#7e1d14] px-2 py-0.5 text-[8px] uppercase tracking-[0.18em] text-[#ffe3de]">
            Outreach
          </span>
          <span className="absolute bottom-3 left-3 text-[15px] text-[#f7f5f4]">City Outreach Day</span>
        </div>
        <div className="mt-auto flex items-center gap-1 rounded-full border border-[#f98e80]/15 bg-[#1b1517] p-1.5">
          <span className="flex items-center gap-1.5 rounded-full border border-[#f98e80]/50 bg-[#f98e80]/15 px-3 py-1.5 text-[11px] text-[#f98e80]">
            <Compass size={13} weight="fill" /> Discover
          </span>
          <span className="flex flex-1 justify-around text-[#7e7376]">
            <Buildings size={16} weight="fill" />
            <Ticket size={16} weight="fill" />
            <Heart size={16} />
            <User size={16} weight="fill" />
          </span>
        </div>
      </div>
    </div>
  );
}
