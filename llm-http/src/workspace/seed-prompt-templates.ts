import { promptTemplates, type DbClient } from "@ai-connect/db";

/**
 * Seeds the 12 org-level prompt templates from the design data set.
 * Idempotent: uses onConflictDoNothing keyed on slug, so re-running inserts 0 new rows.
 */
export async function seedPromptTemplates(client: DbClient): Promise<void> {
  await client.db
    .insert(promptTemplates)
    .values([
      {
        slug: "t1",
        title: "Review Pull Request",
        category: "Kỹ thuật",
        icon: "code",
        uses: 1240,
        authorName: "Thược",
        description: "Phân tích diff, gắn cờ rủi ro bảo mật và đề xuất sửa đổi.",
      },
      {
        slug: "t2",
        title: "Sinh User Story",
        category: "Phân tích (BA)",
        icon: "chart-line",
        uses: 980,
        authorName: "Lan",
        description: "Chuyển yêu cầu thô thành user story + tiêu chí chấp nhận.",
      },
      {
        slug: "t3",
        title: "Test Case từ Spec",
        category: "Kiểm thử (QA)",
        icon: "bug",
        uses: 870,
        authorName: "Tuấn",
        description: "Tạo bộ test case (happy / edge / negative) từ đặc tả.",
      },
      {
        slug: "t4",
        title: "Tóm tắt Standup",
        category: "Quản lý (PM)",
        icon: "briefcase",
        uses: 760,
        authorName: "Minh",
        description: "Tổng hợp cập nhật hằng ngày thành bản tóm tắt cho stakeholder.",
      },
      {
        slug: "t5",
        title: "Mô tả sản phẩm",
        category: "Marketing",
        icon: "sparkles",
        uses: 642,
        authorName: "Nga",
        description: "Viết mô tả sản phẩm chuẩn SEO theo tông thương hiệu.",
      },
      {
        slug: "t6",
        title: "Phản hồi khiếu nại",
        category: "CSKH",
        icon: "message-square",
        uses: 590,
        authorName: "Hà",
        description: "Soạn phản hồi đồng cảm, đúng quy trình cho khiếu nại khách hàng.",
      },
      {
        slug: "t7",
        title: "Giải thích truy vấn SQL",
        category: "Dữ liệu",
        icon: "hash",
        uses: 480,
        authorName: "Phong",
        description: "Diễn giải truy vấn phức tạp thành ngôn ngữ tự nhiên.",
      },
      {
        slug: "t8",
        title: "Refactor an toàn",
        category: "Kỹ thuật",
        icon: "git-branch",
        uses: 455,
        authorName: "Phong",
        description: "Đề xuất refactor giữ nguyên hành vi, kèm bước kiểm chứng.",
      },
      {
        slug: "t9",
        title: "Ma trận RACI",
        category: "Quản lý (PM)",
        icon: "grid-3x3",
        uses: 432,
        authorName: "Minh",
        description: "Lập ma trận trách nhiệm cho một sáng kiến nhiều bên.",
      },
      {
        slug: "t10",
        title: "Kịch bản hồi quy",
        category: "Kiểm thử (QA)",
        icon: "circle-check",
        uses: 410,
        authorName: "Mai",
        description: "Lập danh sách hồi quy ưu tiên trước mỗi lần phát hành.",
      },
      {
        slug: "t11",
        title: "Phân tích đối thủ",
        category: "Phân tích (BA)",
        icon: "chart-line",
        uses: 388,
        authorName: "Lan",
        description: "Khung so sánh tính năng và định vị đối thủ cạnh tranh.",
      },
      {
        slug: "t12",
        title: "Email onboarding",
        category: "Marketing",
        icon: "mail",
        uses: 351,
        authorName: "Nga",
        description: "Chuỗi email chào mừng người dùng mới theo từng giai đoạn.",
      },
    ])
    .onConflictDoNothing({ target: promptTemplates.slug });
}
