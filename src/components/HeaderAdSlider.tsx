"use client";

import Image from "next/image";

type Slide = {
  src: string;
  alt: string;
  title: string;
  subtitle: string;
};

const slides: Slide[] = [
  {
    src: "/images/banner01.jpg",
    alt: "Casino banner one",
    title: "Welcome Bonus Blast",
    subtitle: "Up to $500 + 50 free spins for new players",
  },
  {
    src: "/images/banner02.jpg",
    alt: "Casino banner two",
    title: "Weekend Cashback",
    subtitle: "Get 12% cashback every Sunday on slot losses",
  },
  {
    src: "/images/banner03.jpg",
    alt: "Casino banner three",
    title: "Live Tournament Night",
    subtitle: "Compete for the mega prize pool tonight",
  },
];

export default function HeaderAdSlider() {
  const current = slides[0];

  return (
    <div className="flex h-full min-w-0 items-stretch">
      <div className="relative h-full min-h-[96px] min-w-0 flex-1 overflow-hidden rounded-xl border border-[#28406b] bg-[#0b1730]">
        <Image
          src={current.src}
          alt={current.alt}
          fill
          sizes="(min-width: 768px) 520px, 100vw"
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050d1d]/80 via-[#08122c]/45 to-[#08122c]/70" />
        <div className="absolute inset-0 flex items-center px-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#e8f0ff]">{current.title}</p>
            <p className="truncate text-[11px] text-[#b8cbed]">{current.subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
